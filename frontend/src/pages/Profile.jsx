import React, { useRef } from "react";
import { ChevronLeft, Camera, Award, Flame, CheckCircle2, Settings } from "lucide-react";
import { Section, EditableLine } from "../components/common";
import { BadgesRow } from "../components/BadgesRow";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";

export function Profile({ profile, setProfile, setScreen }) {
  const fileRef = useRef(null);
  const skills = Object.entries(profile.skills || {});

  function initials(name) {
    return (name || "F").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  function pickPhoto() {
    fileRef.current?.click();
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setProfile({ ...profile, profilePhoto: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("dashboard")}>
        <ChevronLeft size={16} /> Back
      </button>

      <div style={{ ...styles.profileHeaderBlock, marginTop: 16 }}>
        <div style={styles.avatarLarge}>
          {profile.profilePhoto ? (
            <img src={profile.profilePhoto} alt="" style={styles.avatarImg} />
          ) : (
            <span style={styles.avatarLargeInitials}>{initials(profile.founderName)}</span>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: "none" }} />
        <button style={styles.photoUploadBtn} onClick={pickPhoto}>
          <Camera size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {profile.profilePhoto ? "Change photo" : "Add photo"}
        </button>

        <EditableLine tag="div" style={styles.profileName} value={profile.founderName || "Founder"} onSave={(v) => setProfile({ ...profile, founderName: v })} />
        <div style={styles.profileCompany}>{profile.startupName} · {profile.stage}</div>
      </div>

      <div style={styles.statRow}>
        <div style={styles.vitalCard}>
          <Award size={15} color={C.accent} />
          <div style={{ fontFamily: F.mono, fontSize: 18, marginTop: 6 }}>{profile.xp || 0}</div>
          <div style={{ fontSize: 10, color: C.muted }}>XP</div>
        </div>
        <div style={styles.vitalCard}>
          <CheckCircle2 size={15} color={C.accent} />
          <div style={{ fontFamily: F.mono, fontSize: 18, marginTop: 6 }}>{profile.missionsCompleted || 0}</div>
          <div style={{ fontSize: 10, color: C.muted }}>Missions</div>
        </div>
        <div style={styles.vitalCard}>
          <Flame size={15} color={C.accent} />
          <div style={{ fontFamily: F.mono, fontSize: 18, marginTop: 6 }}>{profile.streak || 0}d</div>
          <div style={{ fontSize: 10, color: C.muted }}>Streak</div>
        </div>
      </div>

      <Section title="BIO">
        <EditableLine
          tag="p"
          style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, margin: 0 }}
          value={profile.bio || profile.oneLiner || "Add a short bio…"}
          onSave={(v) => setProfile({ ...profile, bio: v })}
        />
      </Section>

      <Section title="SKILLS">
        <div style={styles.skillList}>
          {skills.map(([name, v]) => (
            <div key={name}>
              <div style={styles.skillLabelRow}>
                <span style={{ fontSize: 13 }}>{name}</span>
                <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>LVL {v.current} → {v.target}</span>
              </div>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFillMuted, width: `${(v.target / 10) * 100}%` }} />
                <div style={{ ...styles.barFill, width: `${(v.current / 10) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <BadgesRow profile={profile} />

      <Section title="SETTINGS">
        <button style={styles.linkRow} onClick={() => setScreen("more")}>
          <Settings size={15} color={C.accent} />
          <span>Feedback, help, legal & more</span>
        </button>
      </Section>
    </div>
  );
}
