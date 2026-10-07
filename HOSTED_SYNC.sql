-- Atomic, optimistic writes. Only the server's existing service role can call this.
create or replace function public.fitness_apply_tp_changes(changes jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare item jsonb; affected integer; total integer := 0;
begin
 for item in select * from jsonb_array_elements(changes) loop
  if item->>'id' is null then
   insert into fitness_workouts(external_id,data) values(item->>'external_id',item->'data') on conflict(external_id) do nothing;
  else
   update fitness_workouts set data=item->'data',updated_at=now() where id=(item->>'id')::uuid and data=item->'expected';
   get diagnostics affected = row_count;
   if affected <> 1 then raise exception 'Workout changed during sync; retry safely'; end if;
  end if;
  get diagnostics affected = row_count; total := total + affected;
 end loop;
 return total;
end $$;
revoke all on function public.fitness_apply_tp_changes(jsonb) from public,anon,authenticated;
grant execute on function public.fitness_apply_tp_changes(jsonb) to service_role;
