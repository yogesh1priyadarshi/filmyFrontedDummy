import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
const USER_API = import.meta.env.VITE_USER_API;
const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;

export default function CreateGroupModal({
  isOpen,
  onClose,
  currentUserId,
  onGroupCreated,
}) {
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Fetch users on search
  useEffect(() => {
    const fetchUsers = async () => {
      if (!search.trim()) {
        setUsers([]);
        return;
      }
      const res = await axios.get(`${USER_API}/users?search=${search}`);
      setUsers(res.data.users);
    };

    fetchUsers();
  }, [search]);

  const toggleUser = (user) => {
    if (selectedUsers.find((u) => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const createGroup = async () => {
    if (!groupName) return alert("Group name is required.");
    if (selectedUsers.length < 2)
      return alert("Select at least 2 members for a group.");
    try {
      const res = await axios.post(`${CONVERSATION_API}/conversations/groups`, {
        groupName,
        participants: selectedUsers.map((u) => u._id),
        adminId: currentUserId,
      });

      onGroupCreated(res.data);
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error creating group.");
    }
  };

  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setUsers([]);
    setSelectedUsers([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal card */}
          <motion.div
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6 z-10"
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>

            <h2 className="text-xl font-semibold mb-4">Create Group Chat</h2>

            {/* Group Name */}
            <input
              type="text"
              placeholder="Group name"
              className="w-full border rounded-lg px-3 py-2 mb-4 focus:ring focus:ring-blue-200"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Search */}
            <input
              type="text"
              placeholder="Search users..."
              className="w-full border rounded-lg px-3 py-2 mb-3 focus:ring focus:ring-blue-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* User Search Results */}
            {users.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto mb-4 p-2">
                {users.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => toggleUser(user)}
                    className={`cursor-pointer px-3 py-2 rounded-lg mb-1 ${
                      selectedUsers.find((u) => u._id === user._id)
                        ? "bg-blue-100"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {user.userName}
                  </div>
                ))}
              </div>
            )}

            {/* Selected Users Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center bg-blue-200 text-blue-900 px-3 py-1 rounded-full"
                >
                  <span>{user.userName}</span>
                  <button
                    onClick={() => toggleUser(user)}
                    className="ml-2 font-bold text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Create Button */}
            <button
              onClick={createGroup}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Create Group
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
