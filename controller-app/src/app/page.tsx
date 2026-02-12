"use client";

import { useRef, useState } from "react";
import { VideoSender, VideoSenderHandle } from "./components/VideoSender";
import { VideoReceiver, VideoReceiverHandle } from "./components/VideoReceiver";
import { useSignaling } from "./hooks/useSignaling";

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  );

  const senderRef = useRef<VideoSenderHandle>(null);
  const receiverRef = useRef<VideoReceiverHandle>(null);

  // 使用 WebSocket 信令服务器
  const { isConnected, sendOffer, sendAnswer, sendIceCandidate } = useSignaling({
    room: "default-room",
    onOffer: async (offer) => {
      console.log("Signaling: Received offer from signaling server");
      setConnectionStatus("connecting");
      if (receiverRef.current) {
        await receiverRef.current.setOffer(offer);
      }
    },
    onAnswer: async (answer) => {
      console.log("Signaling: Received answer from signaling server");
      if (senderRef.current) {
        await senderRef.current.setAnswer(answer);
      }
    },
    onIceCandidate: async (candidate, from) => {
      console.log(`Signaling: Received ICE candidate from ${from}`);
      if (from === "sender" && receiverRef.current) {
        await receiverRef.current.addIceCandidate(candidate);
      } else if (from === "receiver" && senderRef.current) {
        await senderRef.current.addIceCandidate(candidate);
      }
    }
  });

  // 处理来自 Sender 的 offer
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    console.log("Sender: Created offer, sending to signaling server");
    sendOffer(offer);
  };

  // 处理来自 Receiver 的 answer
  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    console.log("Receiver: Created answer, sending to signaling server");
    sendAnswer(answer);
  };

  // 处理来自 Sender 的 ICE candidate
  const handleSenderIceCandidate = async (candidate: RTCIceCandidate) => {
    console.log("Sender: Generated ICE candidate, sending to signaling server");
    sendIceCandidate(candidate, "sender");
  };

  // 处理来自 Receiver 的 ICE candidate
  const handleReceiverIceCandidate = async (candidate: RTCIceCandidate) => {
    console.log("Receiver: Generated ICE candidate, sending to signaling server");
    sendIceCandidate(candidate, "receiver");
  };

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

        {/* 连接状态指示 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500 animate-pulse"
                : connectionStatus === "connecting"
                ? "bg-yellow-500"
                : "bg-zinc-500"
            }`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {connectionStatus === "connected"
              ? "已建立连接"
              : connectionStatus === "connecting"
              ? "正在建立连接..."
              : "等待视频流..."}
          </span>
        </div>

        {/* 视频展示区域 */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          {/* 发送端 */}
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl">
              <VideoSender
                ref={senderRef}
                onOffer={handleOffer}
                onIceCandidate={handleSenderIceCandidate}
              />
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
              <VideoReceiver
                ref={receiverRef}
                onAnswer={handleAnswer}
                onIceCandidate={handleReceiverIceCandidate}
              />
            </div>
          </div>
        </div>

        {/* 说明信息 */}
        <div className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-500">
          <p>发送端：获取本地摄像头视频流并传输</p>
          <p>接收端：接收并显示远程视频流</p>
          <p className="mt-2 text-xs">
            信令服务器：WebSocket (ws://localhost:8081) {isConnected ? "✓ 已连接" : "⊗ 未连接"}
          </p>
        </div>
      </main>
    </div>
  );
}
