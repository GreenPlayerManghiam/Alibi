// src/hooks/useAlibiDb.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ProfileState {
  id: string; 
  monthlyAllowance: number; 
  fixedFees: number; 
  remainingDays: number;
}

export function useAlibiDb() {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [spentToday, setSpentToday] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  
  // NEW: State to track spending by category for the Envelopes UI
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  
  const [pendingRegret, setPendingRegret] = useState<any | null>(null);
  const [regretContext, setRegretContext] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // NEW: Wrap in try/finally to prevent infinite loading spinners
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
        const uid = authData?.user?.id;
        
        if (authErr || !uid) {
          console.error("Supabase Auth Error: Please enable Anonymous Sign-in.");
          return;
        }

        // FIXED: Changed .single() to .maybeSingle() to prevent the 406 crash
        let { data: prof } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
        
        if (!prof) {
          // FIXED: Changed .single() to .maybeSingle() here as well
          const { data: newProf } = await supabase.from('profiles')
            .insert([{ user_id: uid, monthly_allowance: 15000, fixed_mess_fees: 3000, remaining_days: 20 }])
            .select().maybeSingle();
          prof = newProf;
        }

        if (prof) {
          setProfile({ id: prof.id, monthlyAllowance: prof.monthly_allowance, fixedFees: prof.fixed_mess_fees, remainingDays: prof.remaining_days });

          const today = new Date().toISOString().split('T')[0];
          
          // NEW: Added 'category' to the select query to build the envelope data
          const { data: allTxs } = await supabase.from('transactions').select('amount, created_at, type, category').eq('profile_id', prof.id);
          
          let total = 0, todayTotal = 0;
          const catTotals: Record<string, number> = {};
          
          allTxs?.forEach(tx => {
            if (tx.type !== 'income') {
              const amt = Number(tx.amount);
              total += amt;
              if (tx.created_at.startsWith(today)) todayTotal += amt;
              
              // NEW: Tally up the categories
              if (tx.category) {
                catTotals[tx.category] = (catTotals[tx.category] || 0) + amt;
              }
            }
          });
          
          setTotalSpent(total); 
          setSpentToday(todayTotal);
          setCategoryTotals(catTotals);

          const { data: unrated } = await supabase.from('transactions').select('*').eq('profile_id', prof.id).eq('type', 'expense').is('regret_score', null).order('created_at', { ascending: false }).limit(1);
          if (unrated?.length) setPendingRegret(unrated[0]);

          const { data: regrets } = await supabase.from('transactions').select('merchant').eq('profile_id', prof.id).eq('regret_score', false).limit(5);
          if (regrets?.length) setRegretContext(`User regrets: ${regrets.map(r => r.merchant).join(', ')}.`);
        }
      } catch (err) {
        console.error("Database initialization failed:", err);
      } finally {
        // NEW: This guarantees the loading screen turns off even on a network error
        setLoading(false);
      }
    }
    init();
  }, []);

  const rateTransaction = async (txId: string, isWorthIt: boolean) => {
    await supabase.from('transactions').update({ regret_score: isWorthIt }).eq('id', txId);
    if (!isWorthIt && pendingRegret) setRegretContext(prev => `${prev} Also regrets ${pendingRegret.merchant}.`);
    setPendingRegret(null);
  };

  const saveTransaction = async (amount: number, category: string, merchant: string, type: 'expense'|'income'|'iou', iouBorrower?: string) => {
    if (!profile) return;
    await supabase.from('transactions').insert([{ profile_id: profile.id, amount, category, merchant, type, iou_borrower: iouBorrower }]);
    if (type !== 'income') {
      setTotalSpent(prev => prev + amount); 
      setSpentToday(prev => prev + amount);
      
      // NEW: Update category totals instantly for the UI
      setCategoryTotals(prev => ({ 
        ...prev, 
        [category]: (prev[category] || 0) + amount 
      }));
    }
  };

  const updateProfile = async (newProfile: { monthlyAllowance: number; fixedFees: number; remainingDays: number }) => {
    if (!profile) return;
    await supabase.from('profiles').update({
      monthly_allowance: newProfile.monthlyAllowance,
      fixed_mess_fees: newProfile.fixedFees,
      remaining_days: newProfile.remainingDays
    }).eq('id', profile.id);

    setProfile({
      ...profile,
      monthlyAllowance: newProfile.monthlyAllowance,
      fixedFees: newProfile.fixedFees,
      remainingDays: newProfile.remainingDays
    });
  };

  // NEW: Export categoryTotals so App.tsx can use it
  return { profile, spentToday, totalSpent, categoryTotals, pendingRegret, regretContext, loading, rateTransaction, saveTransaction, updateProfile };
}