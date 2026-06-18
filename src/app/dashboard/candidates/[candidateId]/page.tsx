"use client";

import React from 'react';
import Link from 'next/link';

export default function CandidateProfile() {
  return (
    <div className="flex flex-col bg-white w-full pr-6 pt-6">
      <div className="flex-1 mt-2 min-w-0">
        {/* Breadcrumb */}
            <div className="flex items-center self-stretch mb-4">
              <span className="text-[#616161] text-xs mr-2 cursor-pointer hover:underline">
                Jobs
              </span>
              <img
                src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/c82l2plk_expires_30_days.png" 
                className="w-1 h-[7px] mr-2 object-fill"
                alt="Chevron"
              />
              <span className="text-[#616161] text-xs mr-[7px] cursor-pointer hover:underline">
                Brand Manager — Atlas
              </span>
              <img
                src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/jniv23zq_expires_30_days.png" 
                className="w-1 h-[7px] mr-2 object-fill"
                alt="Chevron"
              />
              <span className="text-[#212121] text-xs font-semibold">
                Kasun Fernando
              </span>
            </div>

            {/* Candidate Header Card */}
            <div className="flex flex-col md:flex-row items-center self-stretch bg-white py-[25px] px-[21px] mb-4 rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D]">
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-center self-stretch gap-[35px]">
                  <img
                    src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/fmlx8svr_expires_30_days.png" 
                    className="w-[108px] h-[111px] object-cover rounded-full"
                    alt="Profile Picture"
                  />
                  <div className="flex flex-col shrink-0 items-start gap-[3px]">
                    <span className="text-[#212121] text-[22px] font-bold">
                      Kasun Fernando
                    </span>
                    <span className="text-[#616161] text-[13px]">
                      Brand Manager · MAS Holdings
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex shrink-0 items-center bg-[#91F78E26] py-[3px] px-3 gap-1 rounded-full">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/mx2m9b6s_expires_30_days.png" 
                      className="w-[9px] h-[11px] object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#006E1C] text-xs">Colombo</span>
                  </div>
                  <div className="flex shrink-0 items-center bg-[#EEEEE9] py-[3px] px-[11px] gap-1 rounded-full">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/tyfhk563_expires_30_days.png" 
                      className="w-3 h-3 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-xs">6 Years Experience</span>
                  </div>
                  <div className="flex shrink-0 items-center bg-[#EEEEE9] py-[3px] px-[11px] gap-1 rounded-full">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/l1omes5x_expires_30_days.png" 
                      className="w-3 h-2.5 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-xs">MBA — University of Colombo</span>
                  </div>
                  <div className="flex items-center bg-[#EEEEE9] py-[3px] px-3 gap-1 rounded-full">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/2mg7orts_expires_30_days.png" 
                      className="w-[11px] h-[11px] object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-xs">Notice: 1 Month</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-start self-stretch pt-6 pb-1 gap-8 border-t border-gray-100 mt-2">
                  <div className="flex flex-col shrink-0 items-start gap-2">
                    <div className="flex items-center">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/w1xtpicp_expires_30_days.png" 
                        className="w-[13px] h-2.5 mr-2 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#616161] text-xs">kasun@email.com</span>
                    </div>
                    <div className="flex items-center">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/vbhi3cnk_expires_30_days.png" 
                        className="w-3 h-3 mr-2 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#616161] text-xs">+94 77 123 4567</span>
                    </div>
                    <div className="flex items-center">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/s9nxw0qz_expires_30_days.png" 
                        className="w-[13px] h-1.5 mr-2 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#616161] text-xs hover:underline cursor-pointer text-blue-600">linkedin.com/in/kasunfernando</span>
                    </div>
                  </div>
                  <div className="flex flex-col shrink-0 items-start gap-2">
                    <div className="flex items-center">
                      <span className="text-[#212121] text-xs mr-2 w-24">First seen via:</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="bg-blue-500 w-2 h-2 rounded-full"></div>
                        <span className="text-[#616161] text-xs font-medium">LinkedIn (BRAND24)</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-[#212121] text-xs mr-2 w-24">Also applied via:</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="bg-[#CBFC06] w-2 h-2 rounded-full"></div>
                        <span className="text-[#616161] text-xs font-medium">WhatsApp (GMOPS)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Sidebar on Header */}
              <div className="flex flex-col shrink-0 items-center gap-4 w-full md:w-auto mt-6 md:mt-0 md:pl-6 md:border-l border-gray-100">
                <div className="flex flex-col items-center bg-[#F4F4EF] p-4 gap-1 rounded-lg border border-solid border-[#E0E0E0] w-full text-center">
                  <span className="text-[#1B5E20] text-sm font-bold">
                    Best Match 92/100
                  </span>
                  <span className="text-[#616161] text-xs">
                    Brand Manager - Atlas Holdings
                  </span>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full">
                  <button className="flex items-center justify-center bg-[#1B5E20] text-white py-2 px-4 gap-2 rounded-md border-0 hover:bg-[#144718]"
                    onClick={() => alert('Pressed!')}>
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/t6weo40g_expires_30_days.png" 
                      className="w-4 h-4 object-fill filter brightness-0 invert"
                      alt="Icon"
                    />
                    <span className="text-[13px] font-bold">Shortlist for Job</span>
                  </button>
                  <div className="flex items-center gap-2 w-full">
                    <button className="flex-1 flex justify-center items-center bg-transparent py-2 px-2 gap-1 rounded-md border border-solid border-[#E0E0E0] hover:bg-gray-50"
                      onClick={() => alert('Pressed!')}>
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/9sio8d8h_expires_30_days.png" 
                        className="w-4 h-3.5 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#212121] text-[13px] whitespace-nowrap">Trigger AI Call</span>
                    </button>
                    <button className="flex-1 flex justify-center items-center bg-transparent py-2 px-2 gap-1 rounded-md border border-solid border-[#E0E0E0] hover:bg-gray-50"
                      onClick={() => alert('Pressed!')}>
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/z6fl9tx8_expires_30_days.png" 
                        className="w-4 h-3 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#212121] text-[13px] whitespace-nowrap">Send Email</span>
                    </button>
                  </div>
                  <button className="flex items-center justify-center bg-transparent py-2 px-4 gap-2 rounded-md border border-solid border-[#BA1A1A80] hover:bg-red-50 mt-1"
                    onClick={() => alert('Pressed!')}>
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/jhsb99vs_expires_30_days.png" 
                      className="w-4 h-4 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#BA1A1A] text-[13px] font-bold">Reject</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Menu */}
            <div className="flex items-center self-stretch mb-6 border-b border-gray-200">
              <div className="flex flex-col shrink-0 items-center py-3 px-4 border-b-2 border-[#00450D] cursor-pointer">
                <span className="text-[#00450D] text-[13px] font-bold">Overview</span>
              </div>
              <div className="flex flex-col shrink-0 items-center py-3 px-4 cursor-pointer hover:bg-gray-50">
                <span className="text-[#616161] text-[13px]">Timeline</span>
              </div>
              <div className="flex flex-col shrink-0 items-center py-3 px-4 cursor-pointer hover:bg-gray-50">
                <span className="text-[#616161] text-[13px]">Communications</span>
              </div>
              <div className="flex items-center py-3 px-4 gap-2 cursor-pointer hover:bg-gray-50">
                <span className="text-[#616161] text-[13px]">Job Applications</span>
                <div className="bg-[#DADAD5] py-0.5 px-2 rounded-full">
                  <span className="text-[#616161] text-[11px] font-bold">2</span>
                </div>
              </div>
              <div className="flex flex-col shrink-0 items-center py-3 px-4 cursor-pointer hover:bg-gray-50">
                <span className="text-[#616161] text-[13px]">AI Call Log</span>
              </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6">
              
              {/* Left Column (Main Info) */}
              <div className="flex flex-col gap-6">
                
                {/* Extracted Profile CV Snapshot */}
                <div className="flex flex-col bg-white rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D] overflow-hidden">
                  <div className="flex flex-col p-8 pb-16 bg-[#F8FAF2] relative">
                    <div className="flex flex-col items-center text-center pb-6 border-b border-gray-200 mb-6">
                      <span className="text-[#1B5E20] text-2xl font-bold mb-1">Kasun Fernando</span>
                      <span className="text-[#1B1B1D] text-[13px] font-bold mb-3">Brand Manager</span>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-[#5F6368] text-[10px] font-bold tracking-wider">COLOMBO, LK</span>
                        <span className="text-[#5F6368] text-[10px] font-bold">•</span>
                        <span className="text-[#5F6368] text-[10px] font-bold tracking-wider">KASUN@EMAIL.COM</span>
                        <span className="text-[#5F6368] text-[10px] font-bold">•</span>
                        <span className="text-[#5F6368] text-[10px] font-bold tracking-wider">+94 77 123 4567</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                          <span className="text-[#1B5E20] text-xs font-bold tracking-wider">PROFESSIONAL SUMMARY</span>
                          <span className="text-[#1B1B1D] text-sm leading-relaxed">
                            Results-driven Brand Manager with 6+ years of experience in delivering actionable insights for major enterprises. Expert in strategic brand initiatives, product launches, and managing portfolio lines.
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[#1B5E20] text-xs font-bold tracking-wider">EXPERIENCE</span>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[#1B1B1D] text-sm font-bold">Brand Manager</span>
                              <span className="text-[#5F6368] text-[11px] font-medium">2021 - Present</span>
                            </div>
                            <span className="text-[#1B1B1D] text-[13px] font-medium text-gray-700">MAS Holdings</span>
                            <ul className="list-disc pl-5 mt-1 text-[#5F6368] text-xs leading-relaxed space-y-1">
                              <li>Led strategic brand initiatives across regional markets.</li>
                              <li>Improved brand equity scores by 15% YoY.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                          <span className="text-[#1B5E20] text-xs font-bold tracking-wider">SKILLS</span>
                          <div className="flex flex-wrap gap-2">
                            {['Brand Management', 'FMCG', 'P&L Management', 'Market Research', 'Campaign Strategy'].map((skill, i) => (
                              <div key={i} className="bg-[#E8F5E9] py-1 px-2.5 rounded text-[#00450D] text-[11px] font-bold border border-[#C8E6C9]">
                                {skill}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[#1B5E20] text-xs font-bold tracking-wider">EDUCATION</span>
                          <div className="flex flex-col">
                            <span className="text-[#1B1B1D] text-[13px] font-bold">MBA</span>
                            <span className="text-[#5F6368] text-xs mt-0.5">University of Colombo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-t border-[#E0E0E0] p-6 pt-5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/cld9d30o_expires_30_days.png" 
                          className="w-4 h-4 object-fill"
                          alt="Icon"
                        />
                        <span className="text-[#212121] text-[15px] font-bold">AI-Extracted Profile</span>
                      </div>
                      <div className="flex items-center bg-[#91F78E1A] py-1 px-3 gap-1.5 rounded-full border border-[#91F78E4D]">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/zm19wi1a_expires_30_days.png" 
                          className="w-3 h-3 object-fill"
                          alt="Icon"
                        />
                        <span className="text-[#006E1C] text-[11px] font-bold">Confidence: 4.8/5</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[#616161] text-xs font-medium uppercase tracking-wide">Current Title</span>
                          <span className="text-[#212121] text-sm font-semibold">Brand Manager</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[#616161] text-xs font-medium uppercase tracking-wide">Current Employer</span>
                          <span className="text-[#212121] text-sm font-semibold">MAS Holdings</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[#616161] text-xs font-medium uppercase tracking-wide">Total Experience</span>
                          <span className="text-[#212121] text-sm font-semibold">6 Years, 2 Months</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[#616161] text-xs font-medium uppercase tracking-wide">Industry Focus</span>
                          <span className="text-[#212121] text-sm font-semibold">FMCG, Apparel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Work History */}
                <div className="flex flex-col bg-white p-6 rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-6">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/6oile524_expires_30_days.png" 
                      className="w-4 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-base font-bold">Work History</span>
                  </div>
                  
                  <div className="flex flex-col relative pl-4 border-l-2 border-gray-100 ml-2 space-y-6">
                    <div className="flex flex-col relative">
                      <div className="absolute w-3 h-3 bg-[#00450D] rounded-full -left-[23px] top-1 border-[3px] border-white ring-1 ring-gray-200"></div>
                      <span className="text-[#212121] text-[14px] font-bold">Brand Manager</span>
                      <span className="text-[#616161] text-xs mt-0.5 mb-2">MAS Holdings • Jan 2021 - Present (2 yrs 10 mos)</span>
                      <span className="text-[#424242] text-[13px] leading-relaxed">
                        Led strategic brand initiatives across regional markets, managing a portfolio of activewear lines. Improved brand equity scores by 15% YoY.
                      </span>
                    </div>

                    <div className="flex flex-col relative">
                      <div className="absolute w-3 h-3 bg-[#DADAD5] rounded-full -left-[23px] top-1 border-[3px] border-white ring-1 ring-gray-200"></div>
                      <span className="text-[#212121] text-[14px] font-bold">Assistant Brand Manager</span>
                      <span className="text-[#616161] text-xs mt-0.5 mb-2">Unilever • Mar 2018 - Dec 2020 (2 yrs 10 mos)</span>
                      <span className="text-[#424242] text-[13px] leading-relaxed">
                        Managed personal care category product launches and consumer activation campaigns.
                      </span>
                    </div>

                    <div className="flex flex-col relative">
                      <div className="absolute w-3 h-3 bg-[#DADAD5] rounded-full -left-[23px] top-1 border-[3px] border-white ring-1 ring-gray-200"></div>
                      <span className="text-[#212121] text-[14px] font-bold">Marketing Executive</span>
                      <span className="text-[#616161] text-xs mt-0.5">Fonterra • Aug 2016 - Feb 2018 (1 yr 7 mos)</span>
                    </div>
                  </div>
                </div>

                {/* Education */}
                <div className="flex flex-col bg-white p-6 rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-6">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/17w7r1ot_expires_30_days.png" 
                      className="w-4 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-base font-bold">Education</span>
                  </div>
                  <div className="flex flex-col gap-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-[#F8FAF2] p-2 rounded-lg border border-gray-100">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/mqth15nx_expires_30_days.png" 
                          className="w-8 h-8 object-fill"
                          alt="Logo"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#212121] text-[14px] font-bold">Master of Business Administration (MBA)</span>
                        <span className="text-[#616161] text-xs mt-0.5">University of Colombo • 2019 - 2021</span>
                      </div>
                    </div>
                    <div className="h-[1px] bg-gray-100 w-full ml-14"></div>
                    <div className="flex items-start gap-4">
                      <div className="bg-[#F8FAF2] p-2 rounded-lg border border-gray-100">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/dhb2wt1s_expires_30_days.png" 
                          className="w-8 h-8 object-fill"
                          alt="Logo"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#212121] text-[14px] font-bold">BSc (Hons) in Marketing Management</span>
                        <span className="text-[#616161] text-xs mt-0.5">NSBM Green University • 2012 - 2016</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column (Sidebar widgets) */}
              <div className="flex flex-col gap-6">
                
                {/* Active Applications */}
                <div className="flex flex-col bg-white rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D] overflow-hidden">
                  <div className="flex items-center bg-[#FAFAF5] py-3 px-4 border-b border-gray-100">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/4jhtq7qv_expires_30_days.png" 
                      className="w-3.5 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-sm font-bold">Active Applications</span>
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100">
                    <div className="flex flex-col py-4 px-4 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#212121] text-[14px] font-bold text-blue-700 hover:underline">Brand Manager</span>
                        <div className="bg-[#1B5E20] py-0.5 px-2 rounded">
                          <span className="text-white text-[11px] font-bold">92</span>
                        </div>
                      </div>
                      <span className="text-[#616161] text-xs mb-2">Atlas Holdings</span>
                      <div className="flex items-center">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/a818xgw0_expires_30_days.png" 
                          className="w-3 h-3 mr-1.5 object-fill"
                          alt="Icon"
                        />
                        <span className="text-[#00450D] text-[11px] font-medium">Stage: Shortlisted</span>
                      </div>
                    </div>
                    <div className="flex flex-col py-4 px-4 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#212121] text-[14px] font-bold text-blue-700 hover:underline">GM Operations</span>
                        <div className="bg-[#DADAD5] py-0.5 px-2 rounded">
                          <span className="text-[#212121] text-[11px] font-bold">67</span>
                        </div>
                      </div>
                      <span className="text-[#616161] text-xs mb-2">LPI Group</span>
                      <div className="flex items-center">
                        <img
                          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/uq406u12_expires_30_days.png" 
                          className="w-3 h-3 mr-1.5 object-fill"
                          alt="Icon"
                        />
                        <span className="text-[#616161] text-[11px] font-medium">Stage: Applied</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Call Summary */}
                <div className="flex flex-col bg-white p-5 rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-4">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/helwqcbd_expires_30_days.png" 
                      className="w-4 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-sm font-bold">AI Call Summary</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center bg-[#91F78E1A] p-3 gap-3 rounded-lg border border-[#91F78E4D]">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/lg2p63kn_expires_30_days.png" 
                        className="w-8 h-8 rounded-lg object-fill"
                        alt="Avatar"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-[#212121] text-[13px] font-medium">Pre-screen: Brand Manager</span>
                        <span className="text-[#616161] text-xs mt-0.5">Oct 24 • <span className="text-[#00450D] font-medium">Interested</span></span>
                      </div>
                    </div>
                    <div className="flex items-center bg-[#F8FAF2] p-3 gap-3 rounded-lg border border-gray-100">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/ifmm9cq2_expires_30_days.png" 
                        className="w-8 h-8 rounded-lg object-fill"
                        alt="Avatar"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-[#212121] text-[13px] font-medium">Initial Outreach</span>
                        <span className="text-[#616161] text-xs mt-0.5">Oct 22 • No Answer</span>
                      </div>
                    </div>
                    <button className="text-[#00450D] text-[13px] font-bold bg-transparent border-0 mt-1 hover:underline cursor-pointer">
                      View Full Logs
                    </button>
                  </div>
                </div>

                {/* Source History */}
                <div className="flex flex-col bg-white p-5 rounded-xl border border-solid border-[#E0E0E0] shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-5">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/22j0bf3x_expires_30_days.png" 
                      className="w-3.5 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-[#212121] text-sm font-bold">Source History</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500 w-2 h-2 rounded-full mt-1.5 shrink-0"></div>
                      <div className="flex flex-col">
                        <span className="text-[#212121] text-[13px] font-medium leading-tight">Sourced via LinkedIn Extension</span>
                        <span className="text-[#616161] text-xs mt-1">By Sarah Jenkins • Sep 15</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-[#CBFC06] w-2 h-2 rounded-full mt-1.5 shrink-0"></div>
                      <div className="flex flex-col">
                        <span className="text-[#212121] text-[13px] font-medium leading-tight">Applied via WhatsApp Bot</span>
                        <span className="text-[#616161] text-xs mt-1">Campaign: GMOPS • Oct 02</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
  );
}
