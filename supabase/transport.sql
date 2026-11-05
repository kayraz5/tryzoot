-- Zoot · Transport choice (public transport / car): adds 'bus' as a travel mode.
-- Run once in Supabase → SQL Editor (safe to re-run). Without it, saving a plan with a bus leg fails.
alter table public.mission_legs drop constraint if exists mission_legs_travel_mode_check;
alter table public.mission_legs add constraint mission_legs_travel_mode_check
  check (travel_mode in ('walk', 'mrt', 'bus', 'taxi'));
