"use client";

import { VideoSender } from "./components/VideoSender";
import { VideoReceiver } from "./components/VideoReceiver";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black font-sans p-8">
      <main className="w-full max-w-5xl">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            视频传输控制
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            WebRTC 视频流传输演示
          </p>
        </div>

        {/* 视频展示区域 */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          {/* 发送端 */}
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl">
              <VideoSender />
            </div>
          </div>

          {/* 连接箭头 */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
              <span className="text-xs text-zinc-500">WebRTC</span>
            </div>
          </div>

          <div className="flex lg:hidden items-center justify-center">
            <svg
              className="w-8 h-8 text-zinc-400 rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </div>

          {/* 接收端 */}
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl">
              <VideoReceiver />
            </div>
          </div>
        </div>

        {/* 说明信息 */}
        <div className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-500">
          <p>发送端和接收端各自独立连接到信令服务器</p>
          <p>通过 WebSocket 交换 SDP 和 ICE candidates</p>
        </div>
      </main>
    </div>
  );
}
