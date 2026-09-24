import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Ticket } from "./tickets";
import { signTicketToken } from "./ticket-token.functions";

export async function downloadTicketPdf(t: Ticket) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(40, 90, 95);
  doc.rect(0, 0, w, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Coup Sûr", 24, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Reçu officiel • ${t.gameName}`, 24, 52);

  // Body
  doc.setTextColor(20, 20, 20);
  let y = 100;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, 24, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(value, 24, y + 16);
    y += 38;
  };
  line("N° de ticket", t.id);
  if (t.drawName) line("Tirage", t.drawName);
  line("Joueur", `${[t.firstName, t.lastName].filter(Boolean).join(" ") || "—"}  •  ${t.phone}`);
  if (t.legs && t.legs.length > 1) {
    line("Grilles", `${t.legs.length} jeux sur ce reçu`);
    t.legs.forEach((l, i) => {
      line(
        `Grille ${i + 1} — ${l.status.toUpperCase()}`,
        `${l.picksLabel}  •  ${l.stake.toLocaleString()} FCFA`,
      );
    });
  } else {
    line("Sélections", t.picksLabel);
  }
  line("Mise totale", `${t.stake.toLocaleString()} FCFA   (${t.payment})`);
  line("Date tirage", new Date(t.drawDate).toLocaleString());
  line("Statut", t.status.toUpperCase());

  // QR signé → page de vérification publique
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { token } = await signTicketToken({ data: { ticketId: t.id } });
  const qr = await QRCode.toDataURL(`${origin}/verify/${token}`, { margin: 1, width: 220 });
  doc.addImage(qr, "PNG", w - 150, 90, 120, 120);
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Vérifiable par QR Code", w - 144, 222);

  // Footer
  doc.setDrawColor(220, 200, 120);
  doc.setLineWidth(1.2);
  doc.line(
    24,
    doc.internal.pageSize.getHeight() - 50,
    w - 24,
    doc.internal.pageSize.getHeight() - 50,
  );
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Conservez ce reçu. En cas de gain, vous recevrez un SMS de notification.",
    24,
    doc.internal.pageSize.getHeight() - 30,
  );

  doc.save(`ticket-${t.id}.pdf`);
}
