import React from 'react';
import { Tooltip } from 'antd';

// ── Seuils et styles du score de santé ────────────────────────────────────────

const SCORE_LEVELS = [
    { min: 75, label: 'Bon', color: '#2baa55', bg: 'rgba(82,213,121,0.12)', ring: '#2baa55' },
    { min: 50, label: 'Moyen', color: '#c07d00', bg: 'rgba(255,175,42,0.13)', ring: '#c07d00' },
    { min: 25, label: 'Dégradé', color: '#E27954', bg: 'rgba(226,121,84,0.12)', ring: '#E27954' },
    { min: 0, label: 'Critique', color: '#F4364F', bg: 'rgba(244,54,79,0.12)', ring: '#F4364F' },
];

const resolveLevel = (score) =>
    SCORE_LEVELS.find((l) => score >= l.min) ?? SCORE_LEVELS[SCORE_LEVELS.length - 1];

const HealthScoreBadge = ({ score, size = 'md' }) => {
    if (score === null || score === undefined) {
        return <span style={st.empty}>—</span>;
    }

    const level = resolveLevel(score);
    const dim = size === 'sm' ? 34 : 40;
    const radius = (dim - 4) / 2;
    const circum = 2 * Math.PI * radius;
    const offset = circum - (score / 100) * circum;

    const tooltipContent = (
        <span style={{ fontFamily: 'var(--font-family)', fontSize: 12 }}>
            Score santé : <strong>{score}/100</strong> — {level.label}
        </span>
    );

    return (
        <Tooltip title={tooltipContent} placement="top">
            <div style={{ ...st.wrapper, width: dim, height: dim, cursor: 'default' }}>
                <svg width={dim} height={dim} style={st.svg}>
                    <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="var(--ocp-cool-grey-3)" strokeWidth={3} />
                    <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke={level.ring} strokeWidth={3}
                        strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.4s ease' }} />
                </svg>
                <span style={{ ...st.label, color: level.color, fontSize: size === 'sm' ? 9 : 10 }}>{score}</span>
            </div>
        </Tooltip>
    );
};

const st = {
    wrapper: { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    svg: { position: 'absolute', top: 0, left: 0 },
    label: { fontFamily: 'var(--font-family)', fontWeight: 700, lineHeight: 1, zIndex: 1 },
    empty: { color: 'var(--ocp-cool-grey)', fontFamily: 'var(--font-family)', fontSize: 12 },
};

export default HealthScoreBadge;