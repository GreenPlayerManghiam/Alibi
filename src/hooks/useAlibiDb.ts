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
  const [pendingRegret, setPendingRegret] = useState<any | null>(null);
  const [regretContext, setRegretContext] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.signInAnonymously();
      const uid = authData.user?.id;
      if (!uid) return;

      let { data: prof } = await supabase.from('profiles').select('*').eq('user_id', uid).single();
      if (!prof) {
        const { data: newProf } = await supabase.from('profiles')
          .insert([{ user_id: uid, monthly_allowance: 15000, fixed_mess_fees: 3000, remaining_days: 20 }])
          .select().single();
        prof = newProf;
      }
      setProfile({ id: prof.id, monthlyAllowance: prof.monthly_allowance, fixedFees: prof.fixed_mess_fees, remainingDays: prof.remaining_days });

      const today = new Date().toISOString().split('T')[0];
      const { data: allTxs } = await supabase.from('transactions').select('amount, created_at, type').eq('profile_id', prof.id);
      
      let total = 0, todayTotal = 0;
      allTxs?.forEach(tx => {
        if (tx.type !== 'income') {
          total += Number(tx.amount);
          if (tx.created_at.startsWith(today)) todayTotal += Number(tx.amount);
        }
      });
      setTotalSpent(total); 
      setSpentToday(todayTotal);

      const { data: unrated } = await supabase.from('transactions').select('*').eq('profile_id', prof.id).eq('type', 'expense').is('regret_score', null).order('created_at', { ascending: false }).limit(1);
      if (unrated?.length) setPendingRegret(unrated[0]);

      const { data: regrets } = await supabase.from('transactions').select('merchant').eq('profile_id', prof.id).eq('regret_score', false).limit(5);
      if (regrets?.length) setRegretContext(`User regrets: ${regrets.map(r => r.merchant).join(', ')}.`);

      setLoading(false);
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

  return { profile, spentToday, totalSpent, pendingRegret, regretContext, loading, rateTransaction, saveTransaction, updateProfile };
}