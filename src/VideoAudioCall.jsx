// src/App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";


  const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;
  const USER_API = import.meta.env.VITE_USER_API;
const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;


export default function VideoAudioCall() {
  // Refs to persist across renders
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const otherUserRef = useRef(null); // id of the other peer (remote)

  // Video element refs
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  // UI state
  const [myId, setMyId] = useState("");         // our socket id
  const [targetId, setTargetId] = useState(""); // id to call
  const [incoming, setIncoming] = useState(null); // { from, offer }
  const [isCalling, setIsCalling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [muted, setMuted] = useState(false);

  // STUN/TURN configuration (add TURN servers for production)
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    // { urls: "turn:your.turn.server:3478", username: "...", credential: "..." }
  ];

  // 1) Initialize socket and get local media
  useEffect(() => {
    // 1-a: getUserMedia
    async function initLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Could not get user media", err);
        alert("Could not access camera/mic. Check permissions.");
      }
    }

    initLocalMedia();

    // 1-b: connect to signaling server
    socketRef.current = io(SIGNALING_SERVER_URL);

    // when connected, save our socket id
    socketRef.current.on("connect", () => {
      setMyId(socketRef.current.id);
    });

    // incoming call
    socketRef.current.on("incoming-call", (data) => {
      // data: { from, offer }
      console.log("Incoming call from", data.from);
      setIncoming(data);
      otherUserRef.current = data.from;
    });

    // peer accepted our call (answer)
    socketRef.current.on("call-accepted", async (answer) => {
      console.log("Call accepted: set remote description");
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(answer);
        setIsConnected(true);
        setIsCalling(false);
      }
    });

    // remote ICE candidate
    socketRef.current.on("ice-candidate", async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error("Error adding received ICE candidate", err);
      }
    });

    // cleanup on unmount
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      // stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      // close peer
      if (peerRef.current) peerRef.current.close();
    };
  }, []);


  // Helper: create RTCPeerConnection and attach handlers
  function createPeer() {
    const pc = new RTCPeerConnection({ iceServers });

    // add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // when remote track arrives
    pc.ontrack = (event) => {
      // event.streams[0] is the remote MediaStream
      console.log("ontrack", event);
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    // gather ICE candidates and send to remote peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          to: otherUserRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("PC connection state:", state);
      if (state === "connected") setIsConnected(true);
      if (state === "disconnected" || state === "failed" || state === "closed") {
        setIsConnected(false);
      }
    };

    return pc;
  }

  // 2) Call a user (create offer and send it)
  async function callUser() {
    if (!targetId) {
      alert("Enter a target ID to call.");
      return;
    }
    otherUserRef.current = targetId;
    setIsCalling(true)

    peerRef.current = createPeer();

    try {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      // send offer to target via signaling server
      socketRef.current.emit("call-user", {
        userToCall: targetId,
        offer: peerRef.current.localDescription,
      });
    } catch (err) {
      console.error("Error creating offer", err);
      setIsCalling(false);
    }
  }

  // 3) Answer incoming call
  async function answerCall() {
    if (!incoming) return;
    const { from, offer } = incoming;
    otherUserRef.current = from;
    setIncoming(null);

    peerRef.current = createPeer();

    try {
      // set remote (their offer)
      await peerRef.current.setRemoteDescription(offer);

      // create answer
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      // send answer back
      socketRef.current.emit("answer-call", {
        to: from,
        answer: peerRef.current.localDescription,
      });

      setIsConnected(true);
    } catch (err) {
      console.error("Error answering call", err);
    }
  }

  // 4) End call / hangup
  function endCall() {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    otherUserRef.current = null;
    setIsConnected(false);
    setIsCalling(false);
    setIncoming(null);
  }

  // 5) Toggle mute
  function toggleMute() {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  }

  // 6) Screen share (simple): replace local video track with display media
  async function shareScreen() {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];

      // replace the sender's track in RTCPeerConnection
      const sender = peerRef.current
        ?.getSenders()
        .find((s) => s.track && s.track.kind === "video");

      if (sender) {
        sender.replaceTrack(screenTrack);
      }

      // when screen share stops, re-enable camera track
      screenTrack.onended = () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        if (sender && camTrack) sender.replaceTrack(camTrack);
      };
    } catch (err) {
      console.error("Screen share failed", err);
    }
  }

return (
  <div className="p-6 bg-gray-100 min-h-screen">
    <h2 className="text-2xl font-bold mb-4">React WebRTC + Socket.IO Demo</h2>

    {/* My ID */}
    <div className="mb-4">
      <span className="font-semibold">Your ID:</span>{" "}
      {myId ? myId : "connecting..."}
    </div>

    {/* Local + Remote Videos */}
    <div className="flex gap-4 mb-6">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-48 border rounded-lg shadow"
      />

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-[450px] border rounded-lg shadow"
      />
    </div>

    {/* Controls */}
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <input
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        placeholder="Target user ID to call"
        className="px-3 py-2 w-72 border rounded-md shadow-sm focus:ring focus:ring-blue-300"
      />

      <button
        onClick={callUser}
        disabled={isCalling || isConnected}
        className={`px-4 py-2 rounded-md text-white 
          ${isCalling || isConnected ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}
        `}
      >
        {isCalling ? "Calling..." : "Call"}
      </button>

      <button
        onClick={endCall}
        disabled={!isConnected && !isCalling}
        className={`px-4 py-2 rounded-md text-white 
          ${!isConnected && !isCalling ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"}
        `}
      >
        End
      </button>

      <button
        onClick={toggleMute}
        className="px-4 py-2 rounded-md text-white bg-gray-700 hover:bg-gray-800"
      >
        {muted ? "Unmute" : "Mute"}
      </button>

      <button
        onClick={shareScreen}
        disabled={!peerRef.current}
        className={`px-4 py-2 rounded-md text-white 
          ${!peerRef.current ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}
        `}
      >
        Share Screen
      </button>
    </div>

    {/* Incoming Call Popup */}
    {incoming && (
      <div className="border p-4 bg-white shadow-md rounded-md w-[420px]">
        <div className="mb-2 font-semibold">
          Incoming call from: {incoming.from}
        </div>

        <div className="flex gap-3">
          <button
            onClick={answerCall}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Answer
          </button>

          <button
            onClick={() => {
              setIncoming(null);
              socketRef.current.emit("reject-call", { to: incoming.from });
            }}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
          >
            Reject
          </button>
        </div>
      </div>
    )}

    <div className="mt-6">
      <small className="text-gray-600">
        Connected:{" "}
        <span className={isConnected ? "text-green-600" : "text-red-600"}>
          {isConnected ? "Yes" : "No"}
        </span>
      </small>
    </div>
  </div>
);
}
