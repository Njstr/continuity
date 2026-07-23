import React, { useState } from "react";
import { CheckCircle2, X, Link2, FileText, Image as ImageIcon } from "lucide-react";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";

export function AccomplishedCard({ mission }) {
  const [open, setOpen] = useState(false);
  const hasProof = mission.proofType && (mission.proofUrl || mission.proofImage || mission.proofDescription);

  return (
    <>
      <div style={styles.missionCard}>
        <div style={styles.missionCardTop}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color={C.accent2} />
            <div style={styles.missionCardTitle}>{mission.title}</div>
          </div>
        </div>
        <div style={styles.missionCardMetaRow}>
          <span style={styles.xpChip}>+{mission.xp || 30} XP</span>
          <span style={styles.metaChip}>{mission.completedAt ? new Date(mission.completedAt).toLocaleDateString() : mission.date}</span>
        </div>
        {hasProof && (
          <button style={{ ...styles.ghostBtn, width: "100%" }} onClick={() => setOpen(true)}>
            View Proof
          </button>
        )}
      </div>

      {open && (
        <div style={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ ...styles.h2, margin: 0, fontSize: 17 }}>Proof of completion</h3>
              <button style={styles.editIconBtn} onClick={() => setOpen(false)}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            {mission.proofType === "screenshot" && mission.proofImage && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <ImageIcon size={13} color={C.accent} />
                  <span style={styles.missionLabel}>SCREENSHOT</span>
                </div>
                <img src={mission.proofImage} alt="Proof" style={styles.proofPreviewImg} />
              </>
            )}
            {mission.proofType === "link" && mission.proofUrl && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Link2 size={13} color={C.accent} />
                  <span style={styles.missionLabel}>LINK</span>
                </div>
                <a href={mission.proofUrl} target="_blank" rel="noreferrer" style={{ color: C.accent2, fontSize: 13, wordBreak: "break-all" }}>
                  {mission.proofUrl}
                </a>
              </>
            )}
            {mission.proofType === "description" && mission.proofDescription && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <FileText size={13} color={C.accent} />
                  <span style={styles.missionLabel}>DESCRIPTION</span>
                </div>
                <p style={styles.missionText}>{mission.proofDescription}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
