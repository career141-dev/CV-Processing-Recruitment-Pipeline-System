# VPS Server Upgrade Requirement Report: Memory & Database Scaling

**Document ID:** `INFRA-REP-2026-08-24`  
**Date:** August 24, 2026  
**Target Environment:** Production VPS (`94.136.189.48` — Contabo)  
**System:** Career141 Multi-Channel Recruitment Pipeline & AI Voice Platform  

---

## 1. Executive Summary

The production VPS hosting Career141 is currently operating at **critical memory saturation**, with host memory usage at **83%** and swap space at **100% exhaustion**. The primary consumer is the self-hosted Convex database backend (`career141-backend-1`), which is actively consuming **5.898 GiB out of its 6 GiB container limit (98.30% utilization)**.

To prevent sudden database service termination (OOM killer events), eliminate I/O swap thrashing, and support ongoing candidate ingestion and real-time voice screening concurrency, **an immediate server memory upgrade is required**.

---

## 2. Real Observed Evidence (Live Server Diagnostics)

The following metrics were captured directly from the production VPS during normal operational workload:

### A. Live Container Resource Consumption (`docker stats`)
```
CONTAINER ID   NAME                    CPU %     MEM USAGE / LIMIT   MEM %     BLOCK I/O
57ba70d240ff   career141-backend-1     35.17%    5.898GiB / 6GiB     98.30%    13.1GB / 7.25GB (⚠️ Critical)
b9565b79e913   career141-voice-agent   0.48%     547.2MiB / 1GiB     53.44%    21.1MB / 0B
e007843c539b   career141-qdrant-1      0.16%     84.08MiB / 512MiB   16.42%    108MB / 3.6MB
46b07470f8c7   career141-dashboard-1   0.00%     70.39MiB / 512MiB   13.75%    1.5MB / 0B
5ecb3ce8c86b   career141-web           0.00%     58.19MiB / 1GiB      5.68%    2.11MB / 0B
1516b73faf28   career141-livekit       0.62%     30.46MiB / 512MiB    5.95%    33.8MB / 0B
ae82e5313f27   career141-livekit-sip   0.11%     24.05MiB / 256MiB    9.39%    14MB / 0B
44f6b6b05166   career141-voice-redis   0.95%     2.801MiB / 256MiB    1.09%    50.6MB / 9.81MB
```

### B. Host System Telemetry (Kernel & OS)
* **Host RAM Usage:** 83%
* **Host Swap Usage:** **100% (Fully Exhausted)**
* **Convex Database Heap:** 5.898 GiB of 6.000 GiB ceiling (**104 MB of safety margin remaining**)

---

## 3. Technical Root Causes

### 1. In-Memory Database Architecture of Self-Hosted Convex
Convex is designed for ultra-low latency real-time subscriptions and transactions. It keeps **all active table metadata, searchlight indexes, and in-memory indexes (8 tables with 21 active indexes)** loaded in RAM. As candidate profiles, CV extractions, messages, and pipeline states grow, Convex's baseline memory footprint scales accordingly.

### 2. Swap Exhaustion & Disk Thrashing
Because the host RAM is saturated, the Linux kernel has paged 100% of the allocated swap space to disk. When Convex runs background index compaction (`VectorCompactor` and `TextCompactor`) or handles incoming WebSocket subscriptions (`/api/1.41.0/sync`), disk I/O thrashing occurs (`13.1GB / 7.25GB Block I/O`), causing latency spikes and slow database bootstrap times.

### 3. Risk of Out-Of-Memory (OOM) Process Termination
Under the current 6 GiB allocation, any temporary surge in candidate batch ingestion, complex search filtering, or multiple concurrent LiveKit voice calls will trigger the Docker/Kernel OOM killer, causing immediate database downtime and connection drops (`502 Bad Gateway`).

---

## 4. Current vs Recommended Server Sizing

| Metric | Current VPS Provisioning | Recommended Upgraded Provisioning | Rationale |
| :--- | :--- | :--- | :--- |
| **Total Physical RAM** | **8 GB – 12 GB** | **24 GB – 32 GB** | Provides dedicated 12–16 GB for Convex, 4 GB for Qdrant/Voice, and host OS headroom |
| **Swap Space** | 4 GB (100% full) | **8 GB – 16 GB (NVMe)** | Emergency spillover buffer without disk thrashing |
| **Convex Backend Limit** | 6.0 GiB (98.3% used) | **12.0 GiB – 16.0 GiB** | Stable headroom for 21+ indexes, compaction, and searchlight caching |
| **Voice Agent + LiveKit** | 1.5 GiB combined | **3.0 GiB combined** | Supports concurrent SIP screening sessions without CPU/memory contention |
| **Qdrant Vector DB** | 512 MiB limit | **2.0 GiB – 4.0 GiB** | Accommodates Voyage AI / OpenAI vector embeddings and HNSW graph growth |

---

## 5. Action Plan & Next Steps

1. **Host Plan Upgrade:** Upgrade the Contabo VPS instance to a plan with at least **24 GB to 32 GB RAM** (e.g. Cloud VPS L / XL or equivalent).
2. **Adjust Docker Allocations:**
   - Update `docker-compose.yml` backend memory limit from `6g` to `12g` (or `16g`).
   - Update Qdrant memory limit to `2g` – `4g`.
3. **Database Health Verification:** Run clean database index compaction and verify 0% swap thrashing.
