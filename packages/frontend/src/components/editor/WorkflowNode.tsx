'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  PlayCircle,
  Webhook,
  Clock,
  GitBranch,
  Shuffle,
  GitMerge,
  Repeat,
  Globe,
  Send,
  Edit3,
  Code,
  Filter,
  BarChart2,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowEditorStore } from '@/lib/store';

const nodeIcons: Record<string, React.ComponentType<any>> = {
  'trigger.manual': PlayCircle,
  'trigger.webhook': Webhook,
  'trigger.cron': Clock,
  'logic.if': GitBranch,
  'logic.switch': Shuffle,
  'logic.merge': GitMerge,
  'logic.loop': Repeat,
  'action.httpRequest': Globe,
  'action.respond': Send,
  'transform.set': Edit3,
  'transform.function': Code,
  'transform.filter': Filter,
  'transform.aggregate': BarChart2,
  'utility.delay': Timer,
  'utility.errorHandler': AlertTriangle,
};

const nodeColors: Record<string, string> = {
  trigger: 'border-green-400 bg-green-50',
  logic: 'border-yellow-400 bg-yellow-50',
  action: 'border-blue-400 bg-blue-50',
  transform: 'border-purple-400 bg-purple-50',
  utility: 'border-gray-400 bg-gray-50',
};

function getNodeCategory(type: string): string {
  return type.split('.')[0] || 'utility';
}

function WorkflowNodeComponent({ data, id, selected }: NodeProps) {
  const selectedNodeId = useWorkflowEditorStore((s) => s.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;
  const nodeType = data.nodeType || '';
  const category = getNodeCategory(nodeType);
  const Icon = nodeIcons[nodeType] || Code;
  const colorClass = nodeColors[category] || nodeColors.utility;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border-2 shadow-sm min-w-[180px] transition-all duration-150',
        colorClass,
        isSelected && 'ring-2 ring-brand-500 ring-offset-2 shadow-md',
        data.disabled && 'opacity-50'
      )}
    >
      {/* Input Handle */}
      {!nodeType.startsWith('trigger.') && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}

      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'p-1.5 rounded-lg',
            category === 'trigger' && 'bg-green-100',
            category === 'logic' && 'bg-yellow-100',
            category === 'action' && 'bg-blue-100',
            category === 'transform' && 'bg-purple-100',
            category === 'utility' && 'bg-gray-100'
          )}
        >
          <Icon size={16} className="text-gray-700" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900 leading-tight">
            {data.label}
          </div>
          <div className="text-xs text-gray-500 capitalize">
            {nodeType.split('.')[1] || nodeType}
          </div>
        </div>
      </div>

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-brand-500 !border-2 !border-white"
      />

      {/* Second output for conditional nodes */}
      {(nodeType === 'logic.if' || nodeType === 'transform.filter') && (
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-3 !h-3 !bg-red-400 !border-2 !border-white"
          style={{ top: '75%' }}
        />
      )}

      {data.disabled && (
        <div className="absolute -top-2 -right-2 bg-gray-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
          OFF
        </div>
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
