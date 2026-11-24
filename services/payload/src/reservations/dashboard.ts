import type { Pool } from "pg";
// All aggregates use the same tenant/record scope and one database snapshot.
export async function schedulingDashboard(db: Pick<Pool, "query">, workspace: number, actor: number | null, timezone: string, days: number) {
  const result = await db.query(`
    WITH bounds AS (
      SELECT (now() AT TIME ZONE $3)::date AS today,
        (now() AT TIME ZONE $3)::date - ($4::integer - 1) AS first
    ), scoped AS (
      SELECT b.*, (b.start_at AT TIME ZONE $3)::date AS day FROM reservation_bookings b
      WHERE b.workspace_id=$1 AND ($2::integer IS NULL OR b.created_by=$2 OR b.professional_id IN (
        SELECT id FROM reservation_catalog WHERE workspace_id=$1 AND kind='professional' AND value->>'userId'=$2::text
      ))
    ), period AS (
      SELECT * FROM scoped,bounds WHERE day BETWEEN bounds.first AND bounds.today
    ), daily AS (
      SELECT d::date AS day, count(p.id)::integer AS count,
        count(p.id) FILTER(WHERE p.status='canceled')::integer AS canceled,
        count(DISTINCT p.customer_email) FILTER(WHERE p.status<>'canceled')::integer AS customers,
        count(p.id) FILTER(WHERE p.status='pending')::integer AS pending,
        coalesce(sum(p.amount_minor) FILTER(WHERE p.payment_status='paid' AND p.status<>'canceled'),0) AS "paidMinor"
      FROM bounds, generate_series(bounds.first::timestamp,bounds.today::timestamp,interval '1 day') d
      LEFT JOIN period p ON p.day=d::date GROUP BY d ORDER BY d
    ), upcoming AS (
      SELECT * FROM scoped WHERE start_at>=now() AND status IN ('pending','confirmed') ORDER BY start_at,id LIMIT 6
    ), today_agenda AS (
      SELECT * FROM scoped WHERE day=(SELECT today FROM bounds) AND status<>'canceled' ORDER BY start_at,id LIMIT 40
    ), services AS (
      SELECT service_id, details->>'serviceName' AS name,count(*)::integer AS count FROM period
      WHERE status<>'canceled' GROUP BY service_id,details->>'serviceName' ORDER BY count(*) DESC,service_id LIMIT 5
    ), professionals AS (
      SELECT professional_id,coalesce(details->>'professionalName','Sin profesional asignado') AS name,count(*)::integer AS count
      FROM period WHERE status<>'canceled' GROUP BY professional_id,details->>'professionalName' ORDER BY count(*) DESC LIMIT 8
    )
    SELECT json_build_object(
      'from',(SELECT first::text FROM bounds),'to',(SELECT today::text FROM bounds),'days',$4::integer,
      'totals',(SELECT json_build_object('bookings',count(*),'confirmed',count(*) FILTER(WHERE status='confirmed'),
        'pending',count(*) FILTER(WHERE status='pending'),'canceled',count(*) FILTER(WHERE status='canceled'),
        'completed',count(*) FILTER(WHERE status='completed'),'customers',count(DISTINCT customer_email) FILTER(WHERE status<>'canceled'),
        'paidMinor',coalesce(sum(amount_minor) FILTER(WHERE payment_status='paid' AND status<>'canceled'),0)) FROM period),
      'daily',coalesce((SELECT json_agg(daily) FROM daily),'[]'::json),
      'upcoming',coalesce((SELECT json_agg(json_build_object('id',id,'customerName',customer_name,'serviceName',details->>'serviceName',
        'professionalName',details->>'professionalName','locationName',details->>'locationName','startAt',start_at,'endAt',end_at,'status',status)) FROM upcoming),'[]'::json),
      'todayTotal',(SELECT count(*) FROM scoped WHERE day=(SELECT today FROM bounds) AND status<>'canceled'),
      'today',coalesce((SELECT json_agg(json_build_object('id',id,'customerName',customer_name,'serviceName',details->>'serviceName',
        'professionalName',details->>'professionalName','startAt',start_at,'endAt',end_at,'status',status)) FROM today_agenda),'[]'::json),
      'services',coalesce((SELECT json_agg(services) FROM services),'[]'::json),
      'professionals',coalesce((SELECT json_agg(professionals) FROM professionals),'[]'::json)
    ) AS dashboard
  `, [workspace, actor, timezone, days]);
  return result.rows[0].dashboard;
}
