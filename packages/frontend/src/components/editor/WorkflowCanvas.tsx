'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowEditorStore } from '@/lib/store';
import { WorkflowNode } from './WorkflowNode';

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

export function WorkflowCanvas() {
  const { workflow, updateWorkflow, setSelectedNode } = useWorkflowEditorStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync workflow data to React Flow nodes
  useEffect(() => {
    if (!workflow) return;

    const flowNodes: Node[] = workflow.nodes.map((node) => ({
      id: node.id,
      type: 'workflowNode',
      position: node.position,
      data: {
        label: node.name,
        nodeType: node.type,
        disabled: node.disabled,
        parameters: node.parameters,
      },
    }));

    const flowEdges: Edge[] = workflow.connections.map((conn) => ({
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      sourceHandle: conn.sourceOutput,
      targetHandle: conn.targetInput,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#4c6ef5', strokeWidth: 2 },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow?.nodes, workflow?.connections]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!workflow || !connection.source || !connection.target) return;

      const newConnection = {
        id: `edge-${Date.now()}`,
        sourceNodeId: connection.source,
        sourceOutput: connection.sourceHandle || 'main',
        targetNodeId: connection.target,
        targetInput: connection.targetHandle || 'main',
      };

      updateWorkflow({
        connections: [...workflow.connections, newConnection],
      });

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#4c6ef5', strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [workflow, updateWorkflow, setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (!workflow) return;
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      updateWorkflow({
        nodes: workflow.nodes.filter((n) => !deletedIds.has(n.id)),
        connections: workflow.connections.filter(
          (c) => !deletedIds.has(c.sourceNodeId) && !deletedIds.has(c.targetNodeId)
        ),
      });
    },
    [workflow, updateWorkflow]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (!workflow) return;
      const deletedIds = new Set(deletedEdges.map((e) => e.id));
      updateWorkflow({
        connections: workflow.connections.filter((c) => !deletedIds.has(c.id)),
      });
    },
    [workflow, updateWorkflow]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!workflow) return;
      updateWorkflow({
        nodes: workflow.nodes.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        ),
      });
    },
    [workflow, updateWorkflow]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onNodeDragStop={onNodeDragStop}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      snapToGrid
      snapGrid={[16, 16]}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      minZoom={0.1}
      maxZoom={2}
      deleteKeyCode="Delete"
      multiSelectionKeyCode="Shift"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e0e0e0" />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          const type = node.data?.nodeType || '';
          if (type.startsWith('trigger.')) return '#00b894';
          if (type.startsWith('logic.')) return '#fdcb6e';
          if (type.startsWith('action.')) return '#74b9ff';
          if (type.startsWith('transform.')) return '#a29bfe';
          return '#636e72';
        }}
        maskColor="rgba(0, 0, 0, 0.1)"
      />
      <Panel position="bottom-center">
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-muted)] shadow-sm">
          {workflow?.nodes.length || 0} nodes | {workflow?.connections.length || 0} connections
        </div>
      </Panel>
    </ReactFlow>
  );
}
