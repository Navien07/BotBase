'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MessageNode } from './nodes/MessageNode'
import { QuestionNode } from './nodes/QuestionNode'
import { ConditionNode } from './nodes/ConditionNode'
import { AIResponseNode } from './nodes/AIResponseNode'
import { APICallNode } from './nodes/APICallNode'
import { BookingNode } from './nodes/BookingNode'
import { LeadCaptureNode } from './nodes/LeadCaptureNode'
import { DelayNode } from './nodes/DelayNode'
import { HandoffNode } from './nodes/HandoffNode'
import type { FlowData } from '@/types/database'

// Convert our DB FlowData types to @xyflow/react Node/Edge types
function toRFNodes(data?: FlowData): Node[] {
  return (data?.nodes ?? []).map((n) => ({
    id: n.id,
    type: n.type ?? 'message',
    position: n.position,
    data: n.data as Record<string, unknown>,
  }))
}

function toRFEdges(data?: FlowData): Edge[] {
  return (data?.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
  }))
}

function toFlowData(nodes: Node[], edges: Edge[]): FlowData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'message',
      position: n.position,
      data: n.data as Record<string, unknown>,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
  }
}

const NODE_TYPES: NodeTypes = {
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  ai_response: AIResponseNode,
  api_call: APICallNode,
  booking: BookingNode,
  lead_capture: LeadCaptureNode,
  delay: DelayNode,
  handoff: HandoffNode,
}

const DEFAULT_EDGE_OPTIONS = {
  style: { stroke: '#404040', strokeWidth: 1.5 },
}

let idCounter = 1000
function newId(type: string) {
  return `${type}_${Date.now()}_${idCounter++}`
}

interface FlowCanvasProps {
  initialData?: FlowData
  onChange?: (data: FlowData) => void
  selectedNodeId?: string | null
  onNodeSelect?: (nodeId: string | null) => void
}

export function FlowCanvas({ initialData, onChange, selectedNodeId, onNodeSelect }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(initialData))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(initialData))

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const next = addEdge(params, eds)
        onChange?.(toFlowData(nodes, next))
        return next
      })
    },
    [nodes, setEdges, onChange]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow-node-type')
      if (!type || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = {
        x: event.clientX - bounds.left - 110,
        y: event.clientY - bounds.top - 40,
      }

      const newNode: Node = {
        id: newId(type),
        type,
        position,
        data: {},
      }

      setNodes((nds) => {
        const next = [...nds, newNode]
        onChange?.(toFlowData(next, edges))
        return next
      })
    },
    [edges, setNodes, onChange]
  )

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
        onPaneClick={() => onNodeSelect?.(null)}
        fitView
        style={{ background: '#0a0a0a' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e1e1e" />
        <Controls
          style={{
            background: 'var(--bb-surface)',
            border: '1px solid var(--bb-border)',
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{
            background: 'var(--bb-surface)',
            border: '1px solid var(--bb-border)',
          }}
          nodeColor="#242424"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  )
}

export { NODE_TYPES }
export type { FlowCanvasProps }
