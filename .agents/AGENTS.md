<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Communication & Problem-Solving Protocol (MANDATORY)

1. **Explain First Before Implementing Changes**:
   - When an issue, error, or unexpected behavior arises, **DO NOT directly make unrequested changes, apply unexpected fallbacks, or alter business configurations without explicit user review**.
   - Always analyze and clearly explain:
     1. **What the exact issue is**
     2. **Why it happened (root cause analysis)**
     3. **What needs to be done / proposed solutions**
   - Provide this clear explanation to the user first so the user is fully aware and aligned before proceeding with code modifications.

2. **Strict Adherence to User Configurations**:
   - Never add unintended secondary fallbacks (e.g., using alternative phone numbers, secondary routes, or workarounds) that deviate from the user's intended primary setup.

3. **Environment Isolation & VPS Resource Protection**:
   - The production Contabo VPS operates near maximum memory/CPU capacity. **Never run dev instances or heavy builds on the production VPS.**
   - All development must run 100% locally via `start-local-dev.bat` (`localhost:3000` + local Convex/dev containers).
   - Direct SSH code editing and direct pushes to `main` are strictly forbidden; all updates must go through feature branches and GitHub PRs -> CI/CD deployment.

