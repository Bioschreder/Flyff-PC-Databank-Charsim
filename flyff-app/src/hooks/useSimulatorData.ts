import { useState, useEffect } from 'react';
import type { JobData, SkillData } from '../formulas';

interface JobsPayload { jobs: JobData[] }
interface SkillsPayload { skills: SkillData[] }
interface ExpEntry { level: number; exp: number; lim: number }

export function useSimulatorData() {
  const [jobs, setJobs]     = useState<JobData[]>([]);
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [expTable, setExpTable] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/jobs.json').then(r => r.json()) as Promise<JobsPayload>,
      fetch('/data/skills.json').then(r => r.json()) as Promise<SkillsPayload>,
      fetch('/data/exp_table.json').then(r => r.json()) as Promise<ExpEntry[]>,
    ]).then(([j, s, expRaw]) => {
      setJobs(j.jobs);
      setSkills(s.skills);
      // Build map: level → exp needed to advance from that level
      const map = new Map<number, number>();
      for (const entry of expRaw) {
        if (entry.level >= 1 && entry.level <= 200 && !map.has(entry.level)) {
          map.set(entry.level, entry.exp);
        }
      }
      setExpTable(map);
      setLoading(false);
    });
  }, []);

  return { jobs, skills, expTable, loading };
}
