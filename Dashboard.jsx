import React, { useEffect, useState } from "react";
import { supabase } from "../App";
import Fuse from "fuse.js";
import { normalizeName } from "../utils";

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [guideHorses, setGuideHorses] = useState([]);
  const [bets, setBets] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    // fetch recent guide_horses
    const { data: gh, error: ghErr } = await supabase
      .from("guide_horses")
      .select("id, horse_name_raw, normalized_name, created_at, form_guides(raw_text)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (ghErr) {
      console.error(ghErr);
      setLoading(false);
      return;
    }
    setGuideHorses(gh || []);

    // fetch bets
    const { data: b, error: bErr } = await supabase.from("bets").select("id, horse_name_raw, normalized_name, statement_id");
    if (bErr) {
      console.error(bErr);
      setLoading(false);
      return;
    }
    setBets(b || []);

    // build fuse index on normalized names (bets)
    const fuse = new Fuse(b || [], { keys: ["normalized_name"], includeScore: true, threshold: 0.35, ignoreLocation: true });

    const res = [];
    for (const ghItem of gh) {
      const q = ghItem.normalized_name || normalizeName(ghItem.horse_name_raw);
      const fRes = fuse.search(q, { limit: 5 });
      const mapped = fRes.map((r) => ({
        guide_horse_id: ghItem.id,
        guide_name_raw: ghItem.horse_name_raw,
        candidate_bet_id: r.item.id,
        candidate_name_raw: r.item.horse_name_raw,
        score: Math.round((1 - r.score) * 100)
      }));
      res.push({ guide: ghItem, matches: mapped });
    }
    setMatches(res);
    setLoading(false);
  }

  async function confirmAlias(guideId, betId) {
    const guide = guideHorses.find((g) => g.id === guideId);
    const bet = bets.find((b) => b.id === betId);
    if (!guide || !bet) return;
    const canonicalName = bet.normalized_name;
    const { error } = await supabase.from("canonical_horses").upsert([{ canonical_name: canonicalName, aliases: [guide.normalized_name] }], { onConflict: "canonical_name" });
    if (error) console.error(error);
    else refresh();
  }

  return (
    <div>
      <h3>Dashboard</h3>
      <button onClick={refresh} disabled={loading}>Refresh</button>
      <div style={{ marginTop: 12 }}>
        {loading && <div>Loading...</div>}
        {!loading && matches.length === 0 && <div>No recent form guides found. Upload a form guide first.</div>}
        {matches.map((m) => (
          <div key={m.guide.id} style={{ borderBottom: "1px solid #eee", padding: 8 }}>
            <strong>{m.guide.horse_name_raw}</strong>
            <div style={{ marginTop: 6 }}>
              {m.matches.length === 0 && <span style={{ color: "#888" }}>No match found</span>}
              {m.matches.map((c) => (
                <div key={c.candidate_bet_id} style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                  <div style={{ width: 360 }}>{c.candidate_name_raw}</div>
                  <div style={{ width: 60 }}>{c.score}%</div>
                  <button onClick={() => confirmAlias(m.guide.id, c.candidate_bet_id)}>Confirm</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
