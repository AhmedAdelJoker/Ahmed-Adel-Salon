import { Scissors, Facebook, Instagram, Music2, Youtube } from "lucide-react";

export default function Footer({ salonName, logoImage, settings }) {
  return (
    <footer
      className="py-24 px-8 border-t bg-[#09090B]"
      style={{ borderColor: "rgba(212, 175, 55, 0.15)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="h-24 w-24 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] shadow-2xl transition-transform hover:scale-110 duration-500">
            {logoImage ? (
              <img src={logoImage} className="h-full w-full object-cover" alt="Logo" />
            ) : (
              <Scissors size={40} />
            )}
          </div>
          <div className="space-y-3">
            <h4 className="text-4xl font-black text-white tracking-tighter">{salonName}</h4>
            <p className="text-[11px] font-black uppercase tracking-[0.6em] text-[#D4AF37] opacity-60">
              The Absolute Royal Experience
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {[
            { href: settings?.socialFacebook, icon: Facebook },
            { href: settings?.socialInstagram, icon: Instagram },
            { href: settings?.socialTiktok, icon: Music2 },
            { href: settings?.socialYoutube, icon: Youtube },
          ]
            .filter((s) => s.href)
            .map((link, i) => (
              <a
                key={i}
                href={link.href}
                className="h-16 w-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#09090B] transition-all duration-500"
              >
                <link.icon size={24} />
              </a>
            ))}
        </div>

        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <p className="text-xs font-bold text-slate-600 tracking-widest uppercase">
          © 2026 {salonName} • All Rights Reserved
        </p>
      </div>
    </footer>
  );
}
