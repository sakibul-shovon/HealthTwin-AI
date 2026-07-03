"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createMember, updateMember, deleteMember, mergeMembers } from "@/lib/api";
import { HouseholdMember } from "@/lib/types";
import { getHousehold } from "@/lib/api";
import { useTwinStore } from "@/lib/store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMemberId?: number | null;
}

export default function FamilyManager({ isOpen, onClose, initialMemberId }: Props) {
  const { household, setHousehold } = useTwinStore();
  const members = household?.members ?? [];
  const [activeTab, setActiveTab] = useState<"list" | "add" | "edit" | "merge">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState<any>({});
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialMemberId) {
        setEditingId(initialMemberId);
        setActiveTab("edit");
        const m = members.find(m => m.id === initialMemberId);
        if (m) {
          setFormData({
            display_name: m.display_name,
            role_label: m.role_label,
            age: m.age,
            sex: m.sex,
            kidney_impaired: m.kidney_impaired,
            liver_impaired: m.liver_impaired,
            pregnant: m.pregnant,
          });
        }
      } else {
        setActiveTab("list");
      }
    }
  }, [isOpen, initialMemberId, members]);

  const refresh = async () => {
    const fresh = await getHousehold();
    if (fresh) setHousehold(fresh);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createMember(formData);
      await refresh();
      setActiveTab("list");
      setFormData({});
    } catch (err) {
      alert("Failed to create member");
    }
    setIsLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setIsLoading(true);
    try {
      await updateMember(editingId, formData);
      await refresh();
      setActiveTab("list");
    } catch (err) {
      alert("Failed to update member");
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setIsLoading(true);
    try {
      await deleteMember(id);
      await refresh();
      setActiveTab("list");
    } catch (err) {
      alert("Failed to delete member");
    }
    setIsLoading(false);
  };

  const handleMerge = async () => {
    if (!editingId || !mergeTarget) return;
    setIsLoading(true);
    try {
      await mergeMembers(editingId, mergeTarget);
      await refresh();
      setActiveTab("list");
    } catch (err) {
      alert("Failed to merge members");
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-full"
          initial={{ y: 20, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Family Manager</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {activeTab === "list" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Members</h3>
                  <button onClick={() => { setActiveTab("add"); setFormData({ role_label: "", display_name: "", age: 30, sex: "unknown" }); }} 
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                    + Add Member
                  </button>
                </div>
                <div className="space-y-3">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          {m.role_label.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{m.role_label} <span className="font-normal text-gray-400">({m.display_name})</span></p>
                          <p className="text-xs text-gray-500">{m.age} yrs • {m.sex}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => {
                          setEditingId(m.id);
                          setFormData({ display_name: m.display_name, role_label: m.role_label, age: m.age, sex: m.sex, kidney_impaired: m.kidney_impaired, liver_impaired: m.liver_impaired, pregnant: m.pregnant });
                          setActiveTab("edit");
                        }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded hover:bg-gray-200">Edit</button>
                        <button onClick={() => handleDelete(m.id)} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded hover:bg-red-100">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activeTab === "add" || activeTab === "edit") && (
              <form onSubmit={activeTab === "add" ? handleCreate : handleUpdate} className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <button type="button" onClick={() => setActiveTab("list")} className="text-gray-400 hover:text-gray-800 text-sm font-semibold">← Back</button>
                  <span className="text-gray-300">|</span>
                  <h3 className="text-sm font-bold text-gray-700">{activeTab === "add" ? "New Member" : "Edit Member"}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Role/Label (e.g., Baba)</label>
                    <input type="text" required value={formData.role_label || ""} onChange={e => setFormData({...formData, role_label: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label>
                    <input type="text" required value={formData.display_name || ""} onChange={e => setFormData({...formData, display_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Age</label>
                    <input type="number" required value={formData.age || ""} onChange={e => setFormData({...formData, age: Number(e.target.value)})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Sex</label>
                    <select value={formData.sex || "unknown"} onChange={e => setFormData({...formData, sex: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="unknown">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase">Health Flags</h4>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={formData.kidney_impaired || false} onChange={e => setFormData({...formData, kidney_impaired: e.target.checked})} /> Kidney Impaired
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={formData.liver_impaired || false} onChange={e => setFormData({...formData, liver_impaired: e.target.checked})} /> Liver Impaired
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={formData.pregnant || false} onChange={e => setFormData({...formData, pregnant: e.target.checked})} /> Pregnant
                  </label>
                </div>

                <div className="pt-6 flex gap-3 justify-end">
                  {activeTab === "edit" && (
                    <button type="button" onClick={() => setActiveTab("merge")} className="px-4 py-2 text-sm font-semibold text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 mr-auto">
                      Merge Duplicates
                    </button>
                  )}
                  <button type="button" onClick={() => setActiveTab("list")} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-md">
                    {isLoading ? "Saving..." : "Save Member"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "merge" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <button type="button" onClick={() => setActiveTab("edit")} className="text-gray-400 hover:text-gray-800 text-sm font-semibold">← Back</button>
                  <span className="text-gray-300">|</span>
                  <h3 className="text-sm font-bold text-gray-700">Merge Members</h3>
                </div>
                
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm font-medium mb-4">
                  Select a duplicate member to merge into <strong>{formData.role_label}</strong>. The duplicate will be removed, and their health data (medications, conditions) will be transferred over.
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Select Duplicate to Remove</label>
                  <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Select a member...</option>
                    {members.filter(m => m.id !== editingId).map(m => (
                      <option key={m.id} value={m.id}>{m.role_label} ({m.display_name})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setActiveTab("edit")} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="button" onClick={handleMerge} disabled={!mergeTarget || isLoading} className="px-6 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 shadow-md">
                    {isLoading ? "Merging..." : "Merge Now"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
