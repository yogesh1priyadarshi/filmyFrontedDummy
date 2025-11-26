import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

export default function Chat() {
  const { id: conversationId } = useParams();
  const user = JSON.parse(localStorage.getItem("user"));
  const senderId = user?.id;
  const [socket, setSocket] = useState(null);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;
  const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ✅ Socket setup
  useEffect(() => {
    const newSocket = io(SIGNALING_SERVER_URL);
    setSocket(newSocket);
    newSocket.emit("join", senderId);

    newSocket.on("connect", () => {
      newSocket.emit("getMessages", { conversationId, userId:senderId }, (msgs) => {
        setChat(msgs || []);
      });
    });

    newSocket.on("receiveMessage", (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    newSocket.on("messageDeletedForMe", ({ messageId }) => {
      setChat((prev) => prev.filter((msg) => msg._id !== messageId));
    });

    newSocket.on("messageDeletedForAll", ({ messageId }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, isDeleted: true, content: "This message was deleted" }
            : msg
        )
      );
    });

    
    newSocket.on("messageEdited", ({ messageId, newContent }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, content: newContent } : msg
        )
      );
    });

    return () => newSocket.disconnect();
  }, [conversationId, senderId]);

  // ✅ Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // 🎙️ Start & Stop Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // 📨 Send Message
  const handleSendMessage = async () => {
    let mediaUrl = null;
    let type = "text";

    if (mediaFile) {
      setPreview(URL.createObjectURL(mediaFile));
      const formData = new FormData();
      formData.append("media", mediaFile);
      const { data } = await axios.post(CONVERSATION_API + "/upload/", formData);
      type = data?.fileType;
      mediaUrl = data?.url;
    }

    const msgData = {
      conversationId,
      sender: senderId,
      content: message,
      type,
      mediaUrl,
    };

    socket.emit("sendMessage", msgData);
    setChat((prev) => [...prev, msgData]);
    setMessage("");
    setMediaFile(null);
  };

  // 🗑️ Delete for me
  const handleDeleteForMe = (messageId) => {
    socket.emit("deleteMessageForMe", { messageId, userId: senderId });
  };

  // ❌ Delete for everyone
  const handleDeleteForAll = (messageId) => {
    socket.emit("deleteMessageForAll", { messageId, userId:senderId, });
  };

  // ✏️ Edit message
  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.content);
  };

  const saveEdit = (messageId) => {
    socket.emit("editMessage", { messageId, newContent: editText, userId:senderId });
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-6">
      {/* 💬 Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-3">
        {chat.length === 0 ? (
          <p className="text-gray-500 text-center mt-4">No messages yet</p>
        ) : (
          chat.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.sender === senderId ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`relative px-4 py-2 rounded-2xl max-w-xs wrap-break-words ${
                  m.sender === senderId
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {/* ✏️ Edit mode */}
                {editingId === m._id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="rounded-lg p-1 text-black"
                    />
                    <button
                      onClick={() => saveEdit(m._id)}
                      className="bg-green-600 text-white rounded px-2 py-1 text-sm"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    {m.isDeleted ? (
                      <i className="text-sm opacity-70">{m.content}</i>
                    ) : (
                      <>
                        {m.type === "text" && m.content}
                        {m.type === "image" && (
                          <img
                            src={m.mediaUrl}
                            alt="attachment"
                            className="rounded-lg max-w-[200px]"
                          />
                        )}
                        {m.type === "video" && (
                          <video
                            src={m.mediaUrl}
                            controls
                            className="rounded-lg max-w-[200px]"
                          />
                        )}
                        {m.type === "audio" && (
                          <audio controls src={m.mediaUrl} className="mt-1" />
                        )}
                      </>
                    )}

                    {/* 🗑️ / ✏️ Options */}
                    {m.sender === senderId && !m.isDeleted && (
                      <div className="flex justify-end gap-2 text-xs mt-1">
                        <button
                          onClick={() => startEdit(m)}
                          className="hover:text-yellow-400"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteForMe(m._id)}
                          className="hover:text-red-400"
                          title="Delete for me"
                        >
                          🗑️ Me
                        </button>
                        <button
                          onClick={() => handleDeleteForAll(m._id)}
                          className="hover:text-red-600"
                          title="Delete for everyone"
                        >
                          ❌ All
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 🎙️ Message Input Section */}
      <div className="mt-4 flex items-center gap-2">
        {/* 🎤 Voice Record */}
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`px-3 py-2 rounded-full ${
            recording ? "bg-red-500 text-white" : "bg-gray-200"
          }`}
          title="Record voice"
        >
          {recording ? "⏹️" : "🎙️"}
        </button>

        {/* 📎 Attach Image/Video */}
        <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded-lg hover:bg-gray-300">
          📎
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setMediaFile(e.target.files[0])}
          />
        </label>

        {/* 💬 Text Input */}
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />

        {/* 🚀 Send */}
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
