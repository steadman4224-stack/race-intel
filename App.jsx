import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import UploadStatement from "./components/UploadStatement";
import UploadFormGuide from "./components/UploadFormGuide";
import Dashboard from "./components/Dashboard";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(res => {
      if (res?.data?.session) setSession(res.data.session);
    });
    const { subscription } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <header>
        <h1>Race Intelligence</h1>
      </header>

      {!session ? (
        <Auth />
      ) : (
        <>
          <p>Signed in as: {session.user.email}</p>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ width: 420 }}>
              <UploadStatement />
              <hr />
              <UploadFormGuide />
            </div>
            <div style={{ flex: 1 }}>
              <Dashboard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  async function signIn() {
    setMessage("Sending sign-in link...");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMessage(error.message);
    else setMessage("Check your email for the sign-in link.");
  }
  return (
    <div>
      <h3>Sign in</h3>
      <p>Enter your email to sign in (magic link).</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button onClick={signIn} style={{ marginLeft: 8 }}>Send Link</button>
      <div style={{ marginTop: 8 }}>{message}</div>
    </div>
  );
}
