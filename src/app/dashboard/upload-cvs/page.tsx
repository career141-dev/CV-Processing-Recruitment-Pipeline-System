"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function UploadCVs() {
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';
  const imageUrl = user?.imageUrl || "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/136f03a3-c845-4fb7-9a5f-2145eae26c62";

  return (
    <div className="flex flex-col bg-white w-full">
              <div className="self-stretch bg-white px-8 md:px-[114px] pt-10">
                <div className="flex flex-col self-stretch bg-[#F5F5F0] max-w-[1052px] pb-[499px] gap-6 rounded-t-[10px]">
                  <div className="flex justify-between items-center self-stretch bg-[#F8FAF2] py-[11px] px-[23px] ml-[13px] rounded-t-[10px]">
                    <div className="flex shrink-0 items-center gap-4">
                      <img
                        src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/xama35jo_expires_30_days.png" 
                        className="w-[15px] h-2.5 object-fill"
                        alt="Icon"
                      />
                      <span className="text-[#002C06] text-2xl font-bold">
                        Upload CV
                      </span>
                    </div>
                    <button className="flex flex-col shrink-0 items-start bg-[#ECEFE6] text-left py-2 px-[7px] rounded-[9999px] border border-solid border-[#E0E0E0]"
                      onClick={() => alert('Pressed!')}>
                      <span className="text-[#191D18] text-xs font-bold">
                        AR
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-col self-stretch mx-8 md:mx-[71px] gap-8">
                    <div className="flex flex-col items-start self-stretch">
                      <span className="text-[#212121] text-2xl font-bold">
                        Upload CVs
                      </span>
                      <span className="text-[#616161] text-[13px]">
                        Add CVs manually — batch or individual
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row items-start self-stretch gap-6">
                      <div className="flex-1 w-full bg-white p-[21px] rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
                        <div className="flex flex-col items-center self-stretch bg-[#FAFAF5] py-[41px] rounded-lg border-2 border-dashed border-[#C0C9BB] cursor-pointer hover:bg-[#f3f3ea] transition-colors">
                          <img
                            src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/1lsh9cij_expires_30_days.png" 
                            className="w-8 h-14 rounded-lg object-fill"
                            alt="Upload Icon"
                          />
                          <div className="flex flex-col items-center pb-1">
                            <span className="text-[#191D18] text-base font-bold text-center">
                              Drag & drop CV files here
                            </span>
                          </div>
                          <div className="flex flex-col items-center pb-[15px]">
                            <span className="text-[#616161] text-[13px]">
                              or click to select files
                            </span>
                          </div>
                          <span className="text-[#9E9E9E] text-[11px] font-bold text-center px-4">
                            PDF, DOC, DOCX, PNG, JPG — UP TO 600 FILES
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col w-full md:w-[320px] shrink-0 items-center bg-white p-5 gap-6 rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
                        <div className="flex flex-col w-full items-start gap-3">
                          <div className="flex flex-col items-start w-full">
                            <span className="text-[#616161] text-[11px] font-bold">
                              TAG THIS UPLOAD
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-4 w-full">
                            <div className="flex flex-col items-start gap-1 w-full">
                              <span className="text-[#9E9E9E] text-[11px] font-bold">
                                CV SOURCE
                              </span>
                              <div className="flex flex-col items-center bg-white rounded-md border border-solid border-[#E0E0E0] w-full cursor-pointer hover:bg-gray-50">
                                <div className="flex flex-col items-start bg-[url('https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/alumixs2_expires_30_days.png')] bg-[length:100%_100%] py-[9px] px-[13px] rounded-md w-full">
                                  <span className="text-[#212121] text-[13px]">
                                    Select Source...
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-1 w-full">
                              <span className="text-[#9E9E9E] text-[11px] font-bold">
                                CAMPAIGN LABEL
                              </span>
                              <input
                                type="text"
                                placeholder="e.g. Q4 Hiring Sprint"
                                className="text-[#212121] bg-white text-[13px] py-[9px] px-3 rounded-md border border-solid border-[#E0E0E0] w-full focus:outline-none focus:border-[#1B5E20]"
                              />
                            </div>
                            <div className="flex flex-col items-start gap-1 w-full">
                              <span className="text-[#9E9E9E] text-[11px] font-bold">
                                ASSIGN TO JOB
                              </span>
                              <div className="flex items-center bg-white p-2.5 gap-[9px] rounded-md border border-solid border-[#E0E0E0] w-full cursor-text hover:border-gray-400">
                                <img
                                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/p77n98hf_expires_30_days.png" 
                                  className="w-[13px] h-[13px] object-fill"
                                  alt="Search Icon"
                                />
                                <input 
                                  type="text"
                                  placeholder="Search open roles..."
                                  className="text-[#212121] text-[13px] bg-transparent border-none outline-none w-full"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <button className="flex items-center bg-[#1B5E20] hover:bg-[#144718] transition-colors text-left py-3 px-[25px] gap-2 rounded-lg border-0 w-full justify-center"
                          onClick={() => alert('Pressed!')}>
                          <img
                            src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/e2zyl18s_expires_30_days.png" 
                            className="w-[13px] h-4 rounded-lg object-fill filter brightness-0 invert"
                            alt="Upload Icon"
                          />
                          <span className="text-white text-sm font-bold">
                            Upload and Process CVs
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  );
}
