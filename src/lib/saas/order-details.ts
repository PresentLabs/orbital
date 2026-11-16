const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function orderDetails(order: Record<string, any>) {
  const currency = /^[A-Z]{3}$/.test(order.currency) ? order.currency : "CLP";
  const amount = (value: unknown) =>
    escape(
      new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "CLP" ? 0 : 2,
      }).format(Number(value) || 0),
    );
  const items = (key: string) => (Array.isArray(order[key]) ? order[key] : []);
  const section = (title: string, body: string) =>
    `<article class="panel order-info"><h2>${title}</h2>${body}</article>`;
  const list = (
    values: any[],
    render: (value: any) => string,
    empty: string,
  ) => (values.length ? values.map(render).join("") : `<p>${empty}</p>`);
  const fees = list(
    items("fee_lines"),
    (line) =>
      `<p>${escape(line.name)} <strong>${amount(line.total)}</strong>${Number(line.total_tax) ? ` · Impuesto ${amount(line.total_tax)}` : ""}</p>`,
    "Sin cargos adicionales.",
  );
  const coupons = list(
    items("coupon_lines"),
    (line) =>
      `<p>${escape(line.code)} <strong>−${amount(line.discount)}</strong></p>`,
    "Sin cupones aplicados.",
  );
  const taxes = list(
    items("tax_lines"),
    (line) =>
      `<p>${escape(line.label || "Impuesto")} ${line.rate_percent != null ? `(${escape(line.rate_percent)} %)` : ""} <strong>${amount(Number(line.tax_total || 0) + Number(line.shipping_tax_total || 0))}</strong></p>`,
    "Sin desglose de impuestos en el pedido.",
  );
  const refunds = list(
    items("refunds"),
    (line) =>
      `<p>Reembolso #${escape(line.id)} <strong>${amount(Math.abs(Number(line.total) || 0))}</strong>${line.reason ? `<br>${escape(line.reason)}` : ""}</p>`,
    "Sin reembolsos.",
  );
  const date = (value: unknown) => {
    const d = new Date(String(value));
    return Number.isFinite(d.getTime())
      ? escape(d.toLocaleString("es-CL"))
      : "Sin registrar";
  };
  const payment = `<p>Referencia de pago: ${escape(order.transaction_id || "Sin referencia")}</p><p>Pagado: ${order.date_paid ? date(order.date_paid) : "Sin fecha registrada"}</p><p>Completado: ${order.date_completed ? date(order.date_completed) : "Sin fecha registrada"}</p><p>Última actualización: ${order.date_modified ? date(order.date_modified) : "Sin registrar"}</p>`;
  return (
    section("Cargos adicionales", fees) +
    section("Cupones y descuentos", coupons) +
    section("Impuestos", taxes) +
    section("Reembolsos", refunds) +
    section("Seguimiento del pago", payment)
  );
}
