-- Fix RLS INSERT policy for profiles table
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
);
