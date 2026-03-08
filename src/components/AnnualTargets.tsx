import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Target, Plus, Edit2, Calendar, TrendingUp, AlertCircle, Check, FileText, Award, BarChart3, Clock } from 'lucide-react';
import jsPDF from 'jspdf';

interface AnnualTarget {
  id: string;
  year: number;
  annual_target_amount: number;
  start_date: string;
  end_date: string;
  working_days: number;
  daily_target: number;
  description: string;
}

interface DailySummary {
  date: string;
  total_produced_value: number;
}

interface CompanySettings {
  setting_key: string;
  setting_value: string;
}

type FilterType = 'all' | 'above' | 'below' | 'on-target';

export default function AnnualTargets() {
  const [targets, setTargets] = useState<AnnualTarget[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<AnnualTarget | null>(null);
  const [dailyData, setDailyData] = useState<DailySummary[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [companyName, setCompanyName] = useState<string>('');

  const dailyChartRef = useRef<HTMLCanvasElement>(null);
  const bonusChartRef = useRef<HTMLCanvasElement>(null);
  const ganttChartRef = useRef<HTMLCanvasElement>(null);

  const [form, setForm] = useState({
    year: new Date().getFullYear().toString(),
    annual_target_amount: '',
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    description: '',
  });

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    loadTargets();
    loadDailyData();
    loadCompanySettings();
  }, [selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      drawDailyChart();
      drawBonusChart();
      drawGanttChart();
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedMonth, dailyData, targets, selectedYear]);

  async function loadCompanySettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'company_name')
      .maybeSingle();

    if (data) {
      setCompanyName(data.setting_value || '');
    }
  }

  async function loadTargets() {
    const { data, error } = await supabase
      .from('annual_targets')
      .select('*')
      .order('year', { ascending: false });

    if (error) {
      console.error('Error loading targets:', error);
      return;
    }

    setTargets(data || []);
  }

  async function loadDailyData() {
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data, error } = await supabase
      .from('daily_sales_summary')
      .select('date, total_produced_value')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) {
      console.error('Error loading daily data:', error);
      return;
    }

    setDailyData(data || []);
  }

  function calculateWorkingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const workingDays = calculateWorkingDays(form.start_date, form.end_date);
    const annualAmount = parseFloat(form.annual_target_amount);
    const dailyTarget = workingDays > 0 ? annualAmount / workingDays : 0;

    const data = {
      year: parseInt(form.year),
      annual_target_amount: annualAmount,
      start_date: form.start_date,
      end_date: form.end_date,
      working_days: workingDays,
      daily_target: dailyTarget,
      description: form.description,
    };

    if (editingTarget) {
      const { error } = await supabase
        .from('annual_targets')
        .update(data)
        .eq('id', editingTarget.id);

      if (error) {
        console.error('Error updating target:', error);
        alert('Erro ao atualizar meta: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('annual_targets')
        .insert([data]);

      if (error) {
        console.error('Error creating target:', error);
        alert('Erro ao criar meta: ' + error.message);
        return;
      }
    }

    resetForm();
    loadTargets();
  }

  function resetForm() {
    setForm({
      year: new Date().getFullYear().toString(),
      annual_target_amount: '',
      start_date: `${new Date().getFullYear()}-01-01`,
      end_date: `${new Date().getFullYear()}-12-31`,
      description: '',
    });
    setEditingTarget(null);
    setShowForm(false);
  }

  function getCurrentTarget(): AnnualTarget | undefined {
    return targets.find((t) => t.year === selectedYear);
  }

  function getYearProgress() {
    const target = getCurrentTarget();
    if (!target) return { value: 0, percentage: 0, remaining: 0 };

    const totalValue = dailyData.reduce((sum, d) => sum + d.total_produced_value, 0);
    const percentage = target.annual_target_amount > 0 ? (totalValue / target.annual_target_amount) * 100 : 0;
    const remaining = Math.max(0, target.annual_target_amount - totalValue);

    return { value: totalValue, percentage, remaining };
  }

  function getMonthlyData() {
    const target = getCurrentTarget();
    if (!target) return [];

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthData = dailyData.filter(d => {
        const date = new Date(d.date);
        return date.getMonth() === i;
      });

      const monthValue = monthData.reduce((sum, d) => sum + d.total_produced_value, 0);
      const monthTarget = target.annual_target_amount / 12;
      const percentage = monthTarget > 0 ? (monthValue / monthTarget) * 100 : 0;

      return {
        month: i + 1,
        name: monthNames[i],
        value: monthValue,
        target: monthTarget,
        percentage,
        status: percentage >= 100 ? 'above' : percentage >= 90 ? 'on-target' : 'below'
      };
    });

    return months;
  }

  function getDailyDataForMonth(month: number) {
    const target = getCurrentTarget();
    if (!target) return [];

    const monthData = dailyData.filter(d => {
      const date = new Date(d.date);
      return date.getMonth() === month - 1;
    });

    return monthData.map(d => {
      const percentage = target.daily_target > 0 ? (d.total_produced_value / target.daily_target) * 100 : 0;
      return {
        date: d.date,
        value: d.total_produced_value,
        target: target.daily_target,
        percentage,
        status: percentage >= 100 ? 'above' : percentage >= 90 ? 'on-target' : 'below'
      };
    });
  }

  function getFilteredMonthlyData() {
    const data = getMonthlyData();

    if (filter === 'all') return data;
    if (filter === 'above') return data.filter(d => d.status === 'above');
    if (filter === 'below') return data.filter(d => d.status === 'below');
    if (filter === 'on-target') return data.filter(d => d.status === 'on-target');

    return data;
  }

  function getPerformanceIndicators() {
    const target = getCurrentTarget();
    if (!target) return null;

    const progress = getYearProgress();
    const monthlyData = getMonthlyData();

    const monthsAboveTarget = monthlyData.filter(d => d.percentage >= 100).length;
    const monthsBelowTarget = monthlyData.filter(d => d.percentage < 100).length;
    const averageMonthly = monthlyData.length > 0 ? monthlyData.reduce((sum, d) => sum + d.percentage, 0) / monthlyData.length : 0;

    const today = new Date();
    const startDate = new Date(target.start_date);
    const endDate = new Date(target.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const timeProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

    const expectedProgress = timeProgress;
    const actualProgress = progress.percentage;
    const performanceGap = actualProgress - expectedProgress;

    return {
      monthsAboveTarget,
      monthsBelowTarget,
      averageMonthly,
      elapsedDays,
      remainingDays,
      timeProgress,
      performanceGap,
    };
  }

  function calculateBonuses(percentage: number) {
    const bonuses = {
      salary14: false,
      salary15Percentage: 0,
      totalBonus: 0
    };

    if (percentage >= 100) {
      bonuses.salary14 = true;
      bonuses.totalBonus = 1;

      if (percentage >= 130) {
        bonuses.salary15Percentage = 100;
        bonuses.totalBonus = 2;
      } else if (percentage >= 115.01) {
        bonuses.salary15Percentage = 60;
        bonuses.totalBonus = 1.6;
      } else if (percentage >= 100) {
        bonuses.salary15Percentage = 30;
        bonuses.totalBonus = 1.3;
      }
    }

    return bonuses;
  }

  function getMonthlyBonusInfo(monthPercentage: number) {
    const bonuses = calculateBonuses(monthPercentage);
    return {
      percentage: monthPercentage,
      ...bonuses
    };
  }

  function getYearlyProjection() {
    const monthlyData = getMonthlyData();
    const completedMonths = monthlyData.filter(m => m.value > 0);

    if (completedMonths.length === 0) return 0;

    const averagePercentage = completedMonths.reduce((sum, m) => sum + m.percentage, 0) / completedMonths.length;
    return averagePercentage;
  }

  function drawGanttChart() {
    const canvas = ganttChartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const target = getCurrentTarget();
    if (!target) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Defina uma meta anual para visualizar o gráfico de Gantt', canvas.width / 2, canvas.height / 2);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 80;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barHeight = 40;

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Cronograma de Metas ${selectedYear}`, canvas.width / 2, 30);

    const startDate = new Date(target.start_date);
    const endDate = new Date(target.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const today = new Date();
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const x = padding + (chartWidth * i) / 12;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();

      if (i < 12) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(monthNames[i].substring(0, 3), x + (chartWidth / 24), padding - 10);
      }
    }

    let yPos = padding + 30;

    const progress = getYearProgress();

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(padding, yPos, chartWidth, barHeight);

    const progressWidth = (chartWidth * progress.percentage) / 100;
    const gradient = ctx.createLinearGradient(padding, yPos, padding + progressWidth, yPos);
    gradient.addColorStop(0, '#0ea5e9');
    gradient.addColorStop(1, '#06b6d4');
    ctx.fillStyle = gradient;
    ctx.fillRect(padding, yPos, Math.min(progressWidth, chartWidth), barHeight);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, yPos, chartWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${progress.percentage.toFixed(1)}% Concluído`, padding + chartWidth / 2, yPos + barHeight / 2 + 5);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Progresso Anual', 10, yPos + barHeight / 2 + 5);

    if (elapsedDays > 0 && elapsedDays < totalDays) {
      const todayX = padding + (chartWidth * elapsedDays) / totalDays;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(todayX, padding);
      ctx.lineTo(todayX, padding + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Hoje', todayX, padding - 25);
    }

    yPos += barHeight + 30;
    const monthlyData = getMonthlyData();
    const rowHeight = 30;

    monthlyData.forEach((month, index) => {
      const monthStartDay = index * (totalDays / 12);
      const monthDays = totalDays / 12;
      const monthX = padding + (chartWidth * monthStartDay) / totalDays;
      const monthWidth = (chartWidth * monthDays) / totalDays;

      let color;
      if (month.percentage >= 100) {
        color = '#22c55e';
      } else if (month.percentage >= 90) {
        color = '#eab308';
      } else if (month.value > 0) {
        color = '#ef4444';
      } else {
        color = '#e2e8f0';
      }

      ctx.fillStyle = color;
      ctx.fillRect(monthX, yPos, monthWidth - 2, rowHeight - 2);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(monthX, yPos, monthWidth - 2, rowHeight - 2);

      if (monthWidth > 60) {
        ctx.fillStyle = month.value > 0 ? '#fff' : '#64748b';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${month.percentage.toFixed(0)}%`, monthX + monthWidth / 2, yPos + rowHeight / 2 + 4);
      }
    });

    const legendY = canvas.height - 35;
    const legendItems = [
      { color: '#22c55e', label: 'Meta Atingida (≥100%)' },
      { color: '#eab308', label: 'Próximo (90-99%)' },
      { color: '#ef4444', label: 'Abaixo (<90%)' },
      { color: '#e2e8f0', label: 'Sem Dados' }
    ];

    let legendX = padding;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY, 15, 15);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, 15, 15);

      ctx.fillStyle = '#1e293b';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 20, legendY + 12);

      legendX += 200;
    });
  }

  function drawDailyChart() {
    const canvas = dailyChartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const target = getCurrentTarget();
    const monthData = getDailyDataForMonth(selectedMonth);

    if (!target || monthData.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados para este mês', canvas.width / 2, canvas.height / 2);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 80;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barWidth = chartWidth / monthData.length - 4;

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Desempenho Diário - ${monthNames[selectedMonth - 1]} ${selectedYear}`, canvas.width / 2, 30);

    const maxValue = Math.max(...monthData.map(d => d.value), target.daily_target) * 1.2;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();

      const value = maxValue * (1 - i / 5);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`R$ ${(value / 1000).toFixed(1)}k`, padding - 10, y + 4);
    }

    const targetY = padding + chartHeight * (1 - target.daily_target / maxValue);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, targetY);
    ctx.lineTo(canvas.width - padding, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Meta: R$ ${target.daily_target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, canvas.width - padding + 5, targetY + 4);

    monthData.forEach((day, index) => {
      const x = padding + (index * (chartWidth / monthData.length)) + 2;
      const barHeight = (day.value / maxValue) * chartHeight;
      const y = padding + chartHeight - barHeight;

      let color;
      if (day.percentage >= 100) {
        color = '#22c55e';
      } else if (day.percentage >= 90) {
        color = '#eab308';
      } else {
        color = '#ef4444';
      }

      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + 'cc');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);

      if (monthData.length <= 20) {
        ctx.fillStyle = '#475569';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + barWidth / 2, canvas.height - padding + 15);
        ctx.rotate(-Math.PI / 4);
        const date = new Date(day.date);
        ctx.fillText(`${date.getDate()}`, 0, 0);
        ctx.restore();
      }

      if (barHeight > 25) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${day.percentage.toFixed(0)}%`, x + barWidth / 2, y + 15);
      }
    });

    const monthlyAverage = monthData.reduce((sum, d) => sum + d.percentage, 0) / monthData.length;

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Média do Mês: ${monthlyAverage.toFixed(1)}% da meta`, canvas.width / 2, canvas.height - 10);

    const legendY = 55;
    const legendItems = [
      { color: '#22c55e', label: '≥100% da meta' },
      { color: '#eab308', label: '90-99% da meta' },
      { color: '#ef4444', label: '<90% da meta' }
    ];

    let legendX = canvas.width / 2 - 200;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY, 15, 15);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, 15, 15);

      ctx.fillStyle = '#1e293b';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 20, legendY + 12);

      legendX += 140;
    });
  }

  function drawBonusChart() {
    const canvas = bonusChartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const target = getCurrentTarget();
    if (!target) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Defina uma meta anual para visualizar o gráfico', canvas.width / 2, canvas.height / 2);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const yearlyProjection = getYearlyProjection();
    const bonusInfo = getMonthlyBonusInfo(yearlyProjection);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Progresso de Conquista das Bonificações', canvas.width / 2, 30);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Projeção Anual: ${yearlyProjection.toFixed(1)}%`, canvas.width / 2, 55);

    const startY = 90;
    const barHeight = 50;
    const spacing = 25;
    const maxWidth = canvas.width - 320;

    const bonusLevels = [
      {
        label: '14º Salário',
        requirement: '≥ 100%',
        target: 100,
        color: '#3b82f6',
        achieved: yearlyProjection >= 100
      },
      {
        label: '30% do 15º Salário',
        requirement: '100% - 115%',
        target: 115,
        color: '#10b981',
        achieved: yearlyProjection >= 100 && yearlyProjection < 115.01
      },
      {
        label: '60% do 15º Salário',
        requirement: '115% - 129.9%',
        target: 129.9,
        color: '#f59e0b',
        achieved: yearlyProjection >= 115.01 && yearlyProjection < 130
      },
      {
        label: '100% do 15º Salário',
        requirement: '≥ 130%',
        target: 130,
        color: '#8b5cf6',
        achieved: yearlyProjection >= 130
      }
    ];

    bonusLevels.forEach((level, index) => {
      const y = startY + (index * (barHeight + spacing));

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(160, y, maxWidth, barHeight);

      const progress = Math.min((yearlyProjection / level.target) * 100, 100);

      const gradient = ctx.createLinearGradient(160, y, 160 + (maxWidth * progress) / 100, y);
      gradient.addColorStop(0, level.color);
      gradient.addColorStop(1, level.color + 'dd');
      ctx.fillStyle = gradient;
      ctx.fillRect(160, y, (maxWidth * progress) / 100, barHeight);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(160, y, maxWidth, barHeight);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(level.label, 10, y + 20);

      ctx.font = '11px Arial';
      ctx.fillStyle = '#64748b';
      ctx.fillText(level.requirement, 10, y + 38);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${progress.toFixed(1)}%`, 160 + maxWidth / 2, y + barHeight / 2 + 5);

      if (level.achieved) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('✓ CONQUISTADO', 160 + maxWidth + 15, y + barHeight / 2 + 5);
      } else {
        const remaining = level.target - yearlyProjection;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Faltam ${remaining.toFixed(1)}%`, 160 + maxWidth + 15, y + barHeight / 2 + 5);
      }
    });

    const summaryY = startY + (bonusLevels.length * (barHeight + spacing)) + 30;

    const summaryGradient = ctx.createLinearGradient(20, summaryY, 20, summaryY + 80);
    summaryGradient.addColorStop(0, '#f0fdf4');
    summaryGradient.addColorStop(1, '#dcfce7');
    ctx.fillStyle = summaryGradient;
    ctx.fillRect(20, summaryY, canvas.width - 40, 80);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, summaryY, canvas.width - 40, 80);

    ctx.fillStyle = '#166534';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Resumo de Bonificação', canvas.width / 2, summaryY + 25);

    ctx.font = 'bold 14px Arial';
    ctx.fillText(
      `14º Salário: ${bonusInfo.salary14 ? '✓ SIM' : '✗ NÃO'}`,
      canvas.width / 3,
      summaryY + 50
    );

    ctx.fillText(
      `15º Salário: ${bonusInfo.salary15Percentage}%`,
      canvas.width / 2,
      summaryY + 50
    );

    ctx.fillText(
      `Total: ${bonusInfo.totalBonus.toFixed(2)} salários`,
      (canvas.width * 2) / 3,
      summaryY + 50
    );

    ctx.font = '12px Arial';
    ctx.fillStyle = '#065f46';
    ctx.fillText(
      'Bonificação projetada com base no desempenho médio atual',
      canvas.width / 2,
      summaryY + 70
    );
  }

  async function generateMonthReport() {
    const target = getCurrentTarget();
    if (!target) {
      alert('Nenhuma meta definida para este ano');
      return;
    }

    const monthData = getDailyDataForMonth(selectedMonth);
    if (monthData.length === 0) {
      alert('Sem dados para o mês selecionado');
      return;
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    let yPos = 20;

    if (companyName) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companyName, 148, yPos, { align: 'center' });
      yPos += 10;
    }

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Relatório de Desempenho - ${monthNames[selectedMonth - 1]} ${selectedYear}`, 148, yPos, { align: 'center' });
    yPos += 15;

    if (dailyChartRef.current) {
      const dailyChartImage = dailyChartRef.current.toDataURL('image/png');
      pdf.addImage(dailyChartImage, 'PNG', 10, yPos, 277, 80);
      yPos += 90;
    }

    if (bonusChartRef.current) {
      const bonusChartImage = bonusChartRef.current.toDataURL('image/png');
      pdf.addImage(bonusChartImage, 'PNG', 10, yPos, 277, 100);
    }

    const monthlyAverage = monthData.reduce((sum, d) => sum + d.percentage, 0) / monthData.length;
    const yearlyProjection = getYearlyProjection();

    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Resumo Detalhado', 148, yPos, { align: 'center' });
    yPos += 15;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Meta Anual: R$ ${target.annual_target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
    yPos += 7;
    pdf.text(`Meta Diária: R$ ${target.daily_target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
    yPos += 7;
    pdf.text(`Período: ${new Date(target.start_date).toLocaleDateString('pt-BR')} até ${new Date(target.end_date).toLocaleDateString('pt-BR')}`, 20, yPos);
    yPos += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text(`Percentual Médio do Mês: ${monthlyAverage.toFixed(2)}%`, 20, yPos);
    yPos += 7;
    pdf.text(`Projeção Anual: ${yearlyProjection.toFixed(2)}%`, 20, yPos);

    pdf.save(`Relatorio_${monthNames[selectedMonth - 1]}_${selectedYear}.pdf`);
  }

  const currentTarget = getCurrentTarget();
  const progress = getYearProgress();
  const indicators = getPerformanceIndicators();
  const filteredData = getFilteredMonthlyData();
  const yearlyProjection = getYearlyProjection();
  const yearBonusInfo = getMonthlyBonusInfo(yearlyProjection);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl shadow-lg p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/aliancer_logo_6cm-01-01.jpg"
              alt="Aliancer Engenharia"
              className="h-16 w-auto"
            />
            <div>
              <h2 className="text-3xl font-bold text-slate-800">
                {companyName || 'Aliancer Engenharia e Topografia'}
              </h2>
              <p className="text-slate-600 mt-1">Dashboard de Metas e Performance</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingTarget(null);
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Nova Meta Anual
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Ano
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Mês para Relatório
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {monthNames.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={generateMonthReport}
                disabled={!currentTarget}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all"
              >
                <FileText className="w-5 h-5" />
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>
      </div>

      {currentTarget ? (
        <>
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-10 h-10" />
                  <div>
                    <div className="text-sm opacity-90">Meta Anual {currentTarget.year}</div>
                    <div className="text-4xl font-bold">R$ {currentTarget.annual_target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="text-sm opacity-90 mt-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(currentTarget.start_date).toLocaleDateString('pt-BR')} até {new Date(currentTarget.end_date).toLocaleDateString('pt-BR')}
                </div>
                <div className="text-sm opacity-90 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4" />
                  {currentTarget.working_days} dias úteis • Meta diária: R$ {currentTarget.daily_target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingTarget(currentTarget);
                  setForm({
                    year: currentTarget.year.toString(),
                    annual_target_amount: currentTarget.annual_target_amount.toString(),
                    start_date: currentTarget.start_date,
                    end_date: currentTarget.end_date,
                    description: currentTarget.description || '',
                  });
                  setShowForm(true);
                }}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Realizado no ano:</span>
                <span className="font-semibold">R$ {progress.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="w-full bg-blue-400 bg-opacity-30 rounded-full h-6">
                <div
                  className="bg-white rounded-full h-6 transition-all flex items-center justify-center text-sm font-bold text-blue-700 shadow-inner"
                  style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                >
                  {progress.percentage >= 10 && `${progress.percentage.toFixed(1)}%`}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span>{progress.percentage.toFixed(1)}% da meta anual</span>
                <span>Faltam R$ {progress.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {indicators && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-blue-500 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 font-medium">Média Mensal</div>
                    <div className="text-2xl font-bold text-gray-900">{indicators.averageMonthly.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">da meta</div>
                  </div>
                  <TrendingUp className={`w-10 h-10 ${indicators.averageMonthly >= 100 ? 'text-green-500' : 'text-orange-500'}`} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-purple-500 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 font-medium">Projeção Anual</div>
                    <div className="text-2xl font-bold text-gray-900">{yearlyProjection.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {yearlyProjection >= 100 ? 'Acima da meta' : 'Abaixo da meta'}
                    </div>
                  </div>
                  {yearlyProjection >= 100 ? (
                    <Check className="w-10 h-10 text-green-500" />
                  ) : (
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-green-500 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 font-medium">Meses Acima da Meta</div>
                    <div className="text-2xl font-bold text-green-600">{indicators.monthsAboveTarget}</div>
                    <div className="text-xs text-gray-500 mt-1">de 12 meses</div>
                  </div>
                  <BarChart3 className="w-10 h-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-orange-500 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 font-medium">Dias Restantes</div>
                    <div className="text-2xl font-bold text-gray-900">{indicators.remainingDays}</div>
                    <div className="text-xs text-gray-500 mt-1">{indicators.timeProgress.toFixed(1)}% do período</div>
                  </div>
                  <Calendar className="w-10 h-10 text-orange-500" />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Gráfico de Gantt - Cronograma Anual
              </h3>
              <button
                onClick={() => {
                  drawDailyChart();
                  drawBonusChart();
                  drawGanttChart();
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
              >
                Atualizar Gráficos
              </button>
            </div>
            <div className="overflow-x-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-4">
              <canvas
                ref={ganttChartRef}
                width={1200}
                height={300}
                style={{ maxWidth: '100%', height: 'auto' }}
                className="border border-gray-200 rounded bg-white shadow-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              Gráfico de Desempenho Diário
            </h3>
            <div className="overflow-x-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-4">
              <canvas
                ref={dailyChartRef}
                width={1200}
                height={400}
                style={{ maxWidth: '100%', height: 'auto' }}
                className="border border-gray-200 rounded bg-white shadow-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-600" />
              Gráfico de Conquista das Bonificações
            </h3>
            <div className="overflow-x-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-4">
              <canvas
                ref={bonusChartRef}
                width={1000}
                height={500}
                style={{ maxWidth: '100%', height: 'auto' }}
                className="border border-gray-200 rounded bg-white shadow-sm"
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-10 h-10" />
              <div>
                <div className="text-sm opacity-90">Projeção de Bonificação Anual</div>
                <div className="text-3xl font-bold">
                  {yearBonusInfo.totalBonus.toFixed(2)} salários adicionais
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-xs opacity-90">14º Salário</div>
                <div className="text-2xl font-bold mt-1">
                  {yearBonusInfo.salary14 ? '✓ SIM' : '✗ NÃO'}
                </div>
                <div className="text-xs opacity-75 mt-1">≥ 100% da meta</div>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-xs opacity-90">15º Salário</div>
                <div className="text-2xl font-bold mt-1">{yearBonusInfo.salary15Percentage}%</div>
                <div className="text-xs opacity-75 mt-1">
                  {yearlyProjection >= 130 ? '≥ 130%' : yearlyProjection >= 115.01 ? '115-129%' : yearlyProjection >= 100 ? '100-115%' : '< 100%'}
                </div>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                <div className="text-xs opacity-90">Baseado em</div>
                <div className="text-2xl font-bold mt-1">{yearlyProjection.toFixed(1)}%</div>
                <div className="text-xs opacity-75 mt-1">Média atual</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Análise Mensal</h3>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os meses</option>
                <option value="above">Acima da meta (≥100%)</option>
                <option value="on-target">No alvo (90-99%)</option>
                <option value="below">Abaixo da meta (&lt;90%)</option>
              </select>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredData.map((item) => (
                <div key={item.month} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all">
                  <div className="w-24 text-sm text-gray-700 font-semibold">{item.name}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-10 relative overflow-hidden shadow-inner">
                        <div
                          className={`rounded-full h-10 transition-all ${
                            item.percentage >= 100
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                              : item.percentage >= 90
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-600'
                              : 'bg-gradient-to-r from-red-500 to-rose-600'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                          R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="w-20 text-sm font-bold text-right">
                        <span className={
                          item.percentage >= 100
                            ? 'text-green-600'
                            : item.percentage >= 90
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }>
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 ml-1">
                      Meta: R$ {item.target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredData.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Nenhum dado encontrado para o filtro selecionado
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-900 text-lg">Nenhuma meta definida para {selectedYear}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Clique em "Nova Meta Anual" para definir a meta e começar o acompanhamento.
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">
              {editingTarget ? 'Editar Meta Anual' : 'Nova Meta Anual'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano
                </label>
                <select
                  required
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!editingTarget}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Anual de Faturamento (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.annual_target_amount}
                  onChange={(e) => setForm({ ...form, annual_target_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 1000000.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início das Atividades
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Fim das Atividades
                  </label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {form.start_date && form.end_date && form.annual_target_amount && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-l-4 border-blue-500 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Cálculo Automático
                  </h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>Dias úteis no período:</span>
                      <span className="font-bold">{calculateWorkingDays(form.start_date, form.end_date)} dias</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Meta diária:</span>
                      <span className="font-bold">
                        R$ {(parseFloat(form.annual_target_amount) / calculateWorkingDays(form.start_date, form.end_date)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-300 text-xs text-blue-600">
                      A meta diária é calculada dividindo a meta anual pelo número de dias úteis (segunda a sexta-feira) no período.
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Observações sobre esta meta..."
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all font-semibold"
                >
                  {editingTarget ? 'Atualizar Meta' : 'Criar Meta'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
