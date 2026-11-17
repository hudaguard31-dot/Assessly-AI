import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import type { ReliabilityStatus } from '../types';

interface StatusIndicatorProps {
  status: ReliabilityStatus;
  manualOverride?: boolean;
  compact?: boolean;
}

export function StatusIndicator({
  status,
  manualOverride = false,
  compact = false,
}: StatusIndicatorProps) {
  if (manualOverride) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap shrink-0">
        <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Verified' : 'Verified by Teacher'}</span>
      </span>
    );
  }

  if (status === 'reliable') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Reliable</span>
      </span>
    );
  }

  if (status === 'review_recommended') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Review Recommended' : 'Teacher Review Recommended'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap shrink-0">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{compact ? 'Manual Required' : 'Manual Grading Required'}</span>
    </span>
  );
}
