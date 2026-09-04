create table public.payroll_payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
 paid_on date not null,
 amount numeric(12,2) not null check (amount > 0),
 created_at timestamptz not null default now(),
 unique(user_id,payroll_run_id,paid_on,amount)
);
create index payroll_payments_user_date on public.payroll_payments(user_id,paid_on);
alter table public.payroll_payments enable row level security;
revoke all on public.payroll_payments from public,anon,authenticated;
grant select,insert,delete on public.payroll_payments to authenticated;
create policy payroll_payments_select on public.payroll_payments for select to authenticated using ((select auth.uid())=user_id);
create policy payroll_payments_insert on public.payroll_payments for insert to authenticated with check ((select auth.uid())=user_id);
create policy payroll_payments_delete on public.payroll_payments for delete to authenticated using ((select auth.uid())=user_id);
create function private.validate_payroll_payment() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_user uuid; v_date date; v_owner uuid;
begin
 if tg_op='DELETE' then v_user:=old.user_id;v_date:=old.paid_on;
 else
  v_user:=new.user_id;v_date:=new.paid_on;
  select user_id into v_owner from public.payroll_runs where id=new.payroll_run_id;
  if v_owner is null or v_owner<>v_user then raise exception 'Invalid payroll owner';end if;
 end if;
 if exists(select 1 from public.accounting_month_locks where user_id=v_user and month=date_trunc('month',v_date)::date) then
  raise exception 'MONTH_LOCKED: El mes del pago está cerrado.';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger payroll_payment_guard before insert or delete on public.payroll_payments for each row execute function private.validate_payroll_payment();
