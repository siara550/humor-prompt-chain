"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Flavor = {
  id: string;
  description: string | null;
  slug: string | null;
  created_datetime_utc: string | null;
};

type Step = {
  id: number;
  humor_flavor_id: string;
  order_by: number;
  llm_temperature: number | null;
  created_datetime_utc: string | null;
};

const API_BASE = "https://api.almostcrackd.ai";

export default function FlavorsList({ initialFlavors, userId }: { initialFlavors: Flavor[]; userId: string }) {
  const [flavors, setFlavors] = useState<Flavor[]>(initialFlavors);
  const [selectedFlavor, setSelectedFlavor] = useState<Flavor | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [captions, setCaptions] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState("");
  const supabase = createClient();

  const loadSteps = async (flavorId: string) => {
    const { data } = await supabase
      .from("humor_flavor_steps")
      .select("id, humor_flavor_id, order_by, llm_temperature, created_datetime_utc")
      .eq("humor_flavor_id", flavorId)
      .order("order_by", { ascending: true });
    setSteps(data ?? []);
  };

  const selectFlavor = async (flavor: Flavor) => {
    setSelectedFlavor(flavor);
    setCaptions([]);
    await loadSteps(flavor.id);
  };

  const handleCreateFlavor = async () => {
    if (!newDesc.trim()) return;
    setStatus("Creating flavor...");
    const slug = newSlug.trim() || newDesc.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase
      .from("humor_flavors")
      .insert({ description: newDesc.trim(), slug })
      .select()
      .single();
    if (error) { setStatus("Error: " + error.message); return; }
    setFlavors([data, ...flavors]);
    setNewDesc("");
    setNewSlug("");
    setStatus("Flavor created!");
  };

  const handleUpdateFlavor = async () => {
    if (!editingFlavor) return;
    setStatus("Updating...");
    const { error } = await supabase
      .from("humor_flavors")
      .update({ description: editingFlavor.description, slug: editingFlavor.slug })
      .eq("id", editingFlavor.id);
    if (error) { setStatus("Error: " + error.message); return; }
    setFlavors(flavors.map(f => f.id === editingFlavor.id ? editingFlavor : f));
    if (selectedFlavor?.id === editingFlavor.id) setSelectedFlavor(editingFlavor);
    setEditingFlavor(null);
    setStatus("Updated!");
  };

  const handleDeleteFlavor = async (id: string) => {
    if (!confirm("Delete this flavor and all its steps?")) return;
    setStatus("Deleting...");
    await supabase.from("humor_flavor_steps").delete().eq("humor_flavor_id", id);
    const { error } = await supabase.from("humor_flavors").delete().eq("id", id);
    if (error) { setStatus("Error: " + error.message); return; }
    setFlavors(flavors.filter(f => f.id !== id));
    if (selectedFlavor?.id === id) { setSelectedFlavor(null); setSteps([]); }
    setStatus("Deleted!");
  };

  const handleAddStep = async () => {
    if (!selectedFlavor) return;
    setStatus("Adding step...");
    const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order_by)) + 1 : 1;
    const { data, error } = await supabase
      .from("humor_flavor_steps")
      .insert({ humor_flavor_id: selectedFlavor.id, order_by: nextOrder, llm_temperature: 0.7, llm_input_type_id: 1, llm_output_type_id: 1 })
      .select()
      .single();
    if (error) { setStatus("Error: " + error.message); return; }
    setSteps([...steps, data]);
    setStatus("Step added!");
  };

  const handleUpdateStep = async (step: Step, temp: number) => {
    const { error } = await supabase
      .from("humor_flavor_steps")
      .update({ llm_temperature: temp })
      .eq("id", step.id);
    if (error) { setStatus("Error: " + error.message); return; }
    setSteps(steps.map(s => s.id === step.id ? { ...s, llm_temperature: temp } : s));
    setStatus("Step updated!");
  };

  const handleDeleteStep = async (stepId: number) => {
    if (!confirm("Delete this step?")) return;
    const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", stepId);
    if (error) { setStatus("Error: " + error.message); return; }
    setSteps(steps.filter(s => s.id !== stepId));
    setStatus("Step deleted!");
  };

  const handleMoveStep = async (index: number, direction: "up" | "down") => {
    const newSteps = [...steps];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSteps.length) return;
    const tempOrder = newSteps[index].order_by;
    newSteps[index].order_by = newSteps[swapIndex].order_by;
    newSteps[swapIndex].order_by = tempOrder;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    setSteps(newSteps);
    await supabase.from("humor_flavor_steps").update({ order_by: newSteps[index].order_by }).eq("id", newSteps[index].id);
    await supabase.from("humor_flavor_steps").update({ order_by: newSteps[swapIndex].order_by }).eq("id", newSteps[swapIndex].id);
    setStatus("Steps reordered!");
  };

  const handleGenerateCaptions = async () => {
    if (!selectedFlavor) return;
    if (!testImageUrl.trim()) { setStatus("Please enter an image URL."); return; }
    setGeneratingCaptions(true);
    setStatus("Getting session...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setStatus("Not logged in."); return; }

      setStatus("Registering image...");
      const registerRes = await fetch(`${API_BASE}/pipeline/upload-image-from-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: testImageUrl.trim(), isCommonUse: false }),
      });
      if (!registerRes.ok) { setStatus("Register failed: " + await registerRes.text()); return; }
      const { imageId } = await registerRes.json();

      setStatus("Generating captions...");
      const captionRes = await fetch(`${API_BASE}/pipeline/generate-captions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, humorFlavorId: selectedFlavor.id }),
      });
      if (!captionRes.ok) { setStatus("Failed: " + await captionRes.text()); return; }
      const captionData = await captionRes.json();
      setCaptions(Array.isArray(captionData) ? captionData : []);
      setStatus("Done!");
    } catch (e: any) {
      setStatus("Error: " + e.message);
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const inp = "bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-orange-500/50 w-full";
  const btn = "px-3 py-1.5 rounded-lg text-sm font-medium transition";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-lg font-semibold mb-4 text-orange-500">Flavors</h2>
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-4">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">New Flavor</p>
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className={`${inp} mb-2`} />
          <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="Slug (optional, auto-generated)" className={`${inp} mb-3`} />
          <button onClick={handleCreateFlavor} className={`${btn} bg-orange-500 text-white hover:bg-orange-400 w-full`}>+ Create Flavor</button>
        </div>
        {status && <p className="text-xs text-white/50 mb-3">{status}</p>}
        <div className="space-y-2">
          {flavors.map(f => (
            <div key={f.id} className={`rounded-2xl border p-4 cursor-pointer transition ${selectedFlavor?.id === f.id ? "border-orange-500 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}>
              {editingFlavor?.id === f.id ? (
                <div>
                  <input value={editingFlavor.description ?? ""} onChange={e => setEditingFlavor({ ...editingFlavor, description: e.target.value })} className={`${inp} mb-2`} />
                  <input value={editingFlavor.slug ?? ""} onChange={e => setEditingFlavor({ ...editingFlavor, slug: e.target.value })} className={`${inp} mb-3`} placeholder="Slug" />
                  <div className="flex gap-2">
                    <button onClick={handleUpdateFlavor} className={`${btn} bg-orange-500 text-white`}>Save</button>
                    <button onClick={() => setEditingFlavor(null)} className={`${btn} bg-white/10 text-white/60`}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => selectFlavor(f)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{f.description ?? f.slug}</p>
                      <p className="text-xs text-white/40 mt-1 font-mono">{f.slug}</p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingFlavor(f)} className={`${btn} bg-white/10 text-white/60 text-xs`}>Edit</button>
                      <button onClick={() => handleDeleteFlavor(f.id)} className={`${btn} bg-red-500/15 text-red-400 text-xs`}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        {selectedFlavor ? (
          <>
            <h2 className="text-lg font-semibold mb-1 text-orange-500">Steps for "{selectedFlavor.description ?? selectedFlavor.slug}"</h2>
            <p className="text-xs text-white/40 mb-4">Use arrows to reorder steps</p>
            <div className="space-y-2 mb-4">
              {steps.map((step, i) => (
                <div key={step.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-orange-500 font-bold text-sm w-6">{i + 1}</span>
                      <div>
                        <p className="text-xs text-white/40 mb-1">Temperature</p>
                        <input type="number" min="0" max="2" step="0.1"
                          value={step.llm_temperature ?? 0.7}
                          onChange={e => handleUpdateStep(step, parseFloat(e.target.value))}
                          className="bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-sm text-white outline-none w-20"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleMoveStep(i, "up")} disabled={i === 0} className={`${btn} bg-white/10 text-white/60 text-xs disabled:opacity-30`}>↑</button>
                      <button onClick={() => handleMoveStep(i, "down")} disabled={i === steps.length - 1} className={`${btn} bg-white/10 text-white/60 text-xs disabled:opacity-30`}>↓</button>
                      <button onClick={() => handleDeleteStep(step.id)} className={`${btn} bg-red-500/15 text-red-400 text-xs`}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleAddStep} className={`${btn} bg-white/10 text-white/70 w-full mb-6`}>+ Add Step</button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Test Caption Generation</p>
              <input value={testImageUrl} onChange={e => setTestImageUrl(e.target.value)} placeholder="Paste an image URL..." className={`${inp} mb-3`} />
              <button onClick={handleGenerateCaptions} disabled={generatingCaptions} className={`${btn} bg-orange-500 text-white w-full disabled:opacity-50`}>
                {generatingCaptions ? status : "Generate Captions"}
              </button>
            </div>

            {captions.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Generated Captions</p>
                <div className="space-y-2">
                  {captions.map((c, i) => (
                    <div key={c.id ?? i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <span className="text-orange-500 text-xs font-bold mr-2">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-sm text-white/80">{c.content ?? c.caption ?? c.text ?? JSON.stringify(c)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64 rounded-2xl border border-white/10 border-dashed">
            <p className="text-white/30">Select a flavor to manage its steps</p>
          </div>
        )}
      </div>
    </div>
  );
}