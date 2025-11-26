import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import CreateGroupModal from "./CreateGroupModal";

export default function ChatPage() {
  
  const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?.id;

  // Fetch all chats
  useEffect(() => {
    const fetchChats = async () => {
      const res = await axios.get(`${CONVERSATION_API}/conversations/${userId}`);
      setConversations(res.data.conversations);
    };
    if (userId) fetchChats();
  }, [userId]);

  return (
    <div>
      {/* Create Group Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        New Group
      </button>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserId={userId}
        onGroupCreated={(group) => navigate(`/chat/${group._id}`)}
      />

      {/* Show list of conversations */}
      <div className="mt-6">
        <h2 className="font-bold">Your Chats</h2>

        {conversations.map((chat) => (
          <div
            key={chat._id}
            onClick={() => navigate(`/chat/${chat._id}`)}
            className="p-3 border-b cursor-pointer hover:bg-gray-100"
          >
            {/* Group Chat */}
            {chat.isGroup ? (
              <p className="font-semibold">📌 {chat.groupName}</p>
            ) : (
              // Individual Chat → find other participant
              <p>
                💬 {chat.participantDetails.find((p) => p._id !== userId).userName}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
