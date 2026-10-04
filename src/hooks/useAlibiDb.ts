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
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  
  const [pendingRegret, setPendingRegret] = useState<any | null>(null);
  const [regretContext, setRegretContext] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
        const uid = authData?.user?.id;
        
        if (authErr || !uid) {
          console.error("Supabase Auth Error: Please enable Anonymous Sign-in.");
          return;
        }

        let { data: prof } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
        
        if (!prof) {
          const { data: newProf } = await supabase.from('profiles')
            .insert([{ user_id: uid, monthly_allowance: 15000, fixed_mess_fees: 3000, remaining_days: 20 }])
            .select().maybeSingle();
          prof = newProf;
        }

        if (prof) {
          setProfile({ id: prof.id, monthlyAllowance: prof.monthly_allowance, fixedFees: prof.fixed_mess_fees, remainingDays: prof.remaining_days });

          const today = new Date().toISOString().split('T')[0];
          
          const { data: allTxs } = await supabase.from('transactions').select('amount, created_at, type, category').eq('profile_id', prof.id);
          
          let total = 0, todayTotal = 0;
          const catTotals: Record<string, number> = {};
          
          allTxs?.forEach(tx => {
            if (tx.type !== 'income') {
              const amt = Number(tx.amount);
              total += amt;
              if (tx.created_at.startsWith(today)) todayTotal += amt;
              
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

  // OPTIMIZED: Optimistic UI Update Pattern for instant synchronization across all components
  const saveTransaction = async (amount: number, category: string, merchant: string, type: 'expense'|'income'|'iou', iouBorrower?: string) => {
    if (!profile) return;

    // 1. INSTANT LOCAL STATE UPDATE (0ms latency)
    // Updates total spent, today's spend, and category envelopes immediately in memory
    if (type !== 'income') {
      setTotalSpent(prev => prev + amount); 
      setSpentToday(prev => prev + amount);
      setCategoryTotals(prev => ({ 
        ...prev, 
        [category]: (prev[category] || 0) + amount 
      }));
    } else {
      setProfile(prev => prev ? { ...prev, monthlyAllowance: prev.monthlyAllowance + amount } : null);
    }

    // 2. BACKGROUND DATABASE SYNC (Non-blocking network request to Supabase)
    try {
      const { error } = await supabase.from('transactions').insert([{ 
        profile_id: profile.id, 
        amount, 
        category, 
        merchant, 
        type, 
        iou_borrower: iouBorrower 
      }]);
      if (error) throw error;
    } catch (err) {
      console.error("Background sync failed:", err);
    }
  };

  const updateProfile = async (newProfile: Partial<{ monthlyAllowance: number; fixedFees: number; remainingDays: number }>) => {
    if (!profile) return;
    
    const updatedData = {
      monthly_allowance: newProfile.monthlyAllowance ?? profile.monthlyAllowance,
      fixed_mess_fees: newProfile.fixedFees ?? profile.fixedFees,
      remaining_days: newProfile.remainingDays ?? profile.remainingDays
    };

    // Instant local state update
    setProfile({
      ...profile,
      monthlyAllowance: updatedData.monthly_allowance,
      fixedFees: updatedData.fixed_mess_fees,
      remainingDays: updatedData.remaining_days
    });

    // Background cloud sync
    await supabase.from('profiles').update(updatedData).eq('id', profile.id);
  };

  return { profile, spentToday, totalSpent, categoryTotals, pendingRegret, regretContext, loading, rateTransaction, saveTransaction, updateProfile };
}