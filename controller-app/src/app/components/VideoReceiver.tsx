"use client";

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";

interface VideoReceiverProps {
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

export interface VideoReceiverHandle {
  setOffer: (offer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
}

export const VideoReceiver = forwardRef<VideoReceiverHandle, VideoReceiverProps>(
  ({ onAnswer, onIceCandidate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const remoteStreamRef = useRef<MediaStream>(new MediaStream());
    const [hasStream, setHasStream] = useState(false);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      setOffer: async (offer: RTCSessionDescriptionInit) => {
        if (!peerConnectionRef.current) {
          // 首次接收 offer 时创建 PeerConnection
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          });

          peerConnectionRef.current = peerConnection;

          // 监听远程轨道
          peerConnection.ontrack = (event) => {
            console.log("Receiver: Received track", event.track.kind);
            remoteStreamRef.current.addTrack(event.track);

            if (videoRef.current) {
              videoRef.current.srcObject = remoteStreamRef.current;
              videoRef.current.play().catch((error) => {
                console.error("Error playing remote video:", error);
              });
            }

            setHasStream(true);
            console.log("Receiver: Remote stream tracks:", remoteStreamRef.current.getTracks().length);
          };

          // 监听连接状态
          peerConnection.onconnectionstatechange = () => {
            console.log("Receiver connection state:", peerConnection.connectionState);
            setConnectionState(peerConnection.connectionState);
          };

          // 监听 ICE 连接状态
          peerConnection.oniceconnectionstatechange = () => {
            console.log("Receiver ICE connection state:", peerConnection.iceConnectionState);
          };

          // 监听 ICE candidates
          peerConnection.onicecandidate = (event) => {
            if (event.candidate && onIceCandidate) {
              console.log("Receiver: ICE candidate", event.candidate.type);
              onIceCandidate(event.candidate);
            } else if (!event.candidate) {
              console.log("Receiver: ICE gathering complete");
            }
          };
        }

        // 设置远程描述（offer）
        await peerConnectionRef.current.setRemoteDescription(offer);
        console.log("Receiver: Set remote description (offer)");

        // 创建并发送 answer
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log("Receiver: Created and set local description (answer)");

        if (onAnswer) {
          onAnswer(answer);
        }
      },
      addIceCandidate: async (candidate: RTCIceCandidate) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log("Receiver: Added ICE candidate");
        }
      },
    }));

    useEffect(() => {
      return () => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          console.log("Receiver: PeerConnection closed");
        }
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      };
    }, []);

    return (
      <div className="flex flex-col gap-4">
        <div className="relative w-full max-w-md">
          <div className="absolute top-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
            接收端
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-2xl shadow-lg bg-zinc-900 aspect-video object-cover"
          />
          {!hasStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-2xl">
              <div className="text-zinc-400 text-center px-4">
                <div className="text-2xl mb-2">📡</div>
                <div>等待视频流...</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionState === "connected"
                ? "bg-green-500"
                : connectionState === "connecting"
                ? "bg-yellow-500"
                : "bg-zinc-500"
            }`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {connectionState === "connected"
              ? "已连接"
              : connectionState === "connecting"
              ? "连接中"
              : "等待连接"}
          </span>
        </div>
      </div>
    );
  }
);

VideoReceiver.displayName = "VideoReceiver";
