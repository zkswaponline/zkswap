"use client";

import { useState } from "react";
import { FAQ } from "@/content/faq";
import { CloseIcon, PlusIcon } from "@/components/site/Icons";

export function FaqBlock() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(0);
  const items = FAQ[tab].items;
  return (
    <div>
      <div className="faqtabs" role="tablist">
        {FAQ.map((g, i) => (
          <button
            key={g.tab}
            type="button"
            role="tab"
            aria-selected={i === tab}
            className={`faqtab ${i === tab ? "on" : ""}`}
            onClick={() => {
              setTab(i);
              setOpen(0);
            }}
          >
            {g.tab}
          </button>
        ))}
      </div>
      {items.map((it, i) => (
        <div key={it.q} className="faqitem">
          <button type="button" className="faqq" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.q}</span>
            <span className="tick" style={{ flex: "none" }}>
              {open === i ? <CloseIcon size={12} /> : <PlusIcon size={12} />}
            </span>
          </button>
          <div className={`faqa ${open === i ? "open" : ""}`}>
            <div>
              <p>{it.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
