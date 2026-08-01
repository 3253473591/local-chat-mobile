import { describe, expect, it } from 'vitest'
import {
  appendTo,
  childrenOf,
  collectSubtreeIds,
  createNode,
  deleteRound,
  deleteSubtree,
  editAssistantNode,
  editUserNode,
  followLatestBranch,
  pathToNode,
  refreshAssistant,
  replyToUser,
  resolveInitialPath,
  sendUserMessage,
  switchVersion,
  type NodeMap,
} from './tree'

const CONV = 'conv1'

function user(id: string, parentId: string | null, content: string, nodes: NodeMap) {
  return createNode(nodes, { conversationId: CONV, parentId, role: 'user', content, id })
}
function asst(id: string, parentId: string, content: string, nodes: NodeMap) {
  return createNode(nodes, { conversationId: CONV, parentId, role: 'assistant', content, id })
}

/** 标准场景：根→U1(A)→R1a(a), R1b(b) */
function buildStandardTree() {
  let nodes: NodeMap = {}
  nodes = appendTo(nodes, user('U1', null, 'A', nodes))
  nodes = appendTo(nodes, asst('R1a', 'U1', 'a', nodes))
  nodes = appendTo(nodes, asst('R1b', 'U1', 'b', nodes))
  return nodes
}

describe('createNode 角色交替', () => {
  it('根下子节点必须为 user', () => {
    expect(() => createNode({}, { conversationId: CONV, parentId: null, role: 'assistant', content: 'x' })).toThrow()
  })
  it('父子角色必须交替', () => {
    const nodes = buildStandardTree()
    // U1 是 user，其下不能直接加 user
    expect(() => createNode(nodes, { conversationId: CONV, parentId: 'U1', role: 'user', content: 'x' })).toThrow()
    // assistant 下不能直接加 assistant
    expect(() => createNode(nodes, { conversationId: CONV, parentId: 'R1a', role: 'assistant', content: 'x' })).toThrow()
  })
  it('同父兄弟版本号递增', () => {
    const nodes = buildStandardTree()
    expect(nodes.R1a.versionIndex).toBe(1)
    expect(nodes.R1b.versionIndex).toBe(2)
    expect(childrenOf(nodes, 'U1').map((n) => n.versionIndex)).toEqual([1, 2])
  })
})

describe('编辑 user → 同父新建 user 节点', () => {
  it('生成新版本并与旧节点同级', () => {
    const base = buildStandardTree()
    const { nodes, newNodeId } = editUserNode(base, 'U1', 'A\'')
    const u2 = nodes[newNodeId]
    expect(u2.role).toBe('user')
    expect(u2.parentId).toBeNull()
    expect(u2.content).toBe('A\'')
    expect(u2.versionIndex).toBe(2) // 与 U1 同级，版本+1
    expect(nodes.U1.versionIndex).toBe(1)
  })
})

describe('刷新 AI → 同父新建 assistant 节点', () => {
  it('新版本与旧回复同级', () => {
    const base = buildStandardTree()
    const { nodes, newNodeId } = refreshAssistant(base, 'U1')
    const r2 = nodes[newNodeId]
    expect(r2.role).toBe('assistant')
    expect(r2.parentId).toBe('U1')
    expect(r2.versionIndex).toBe(3)
  })
})

describe('修改 AI 回复 → 就地覆盖', () => {
  it('覆盖 content 与 reasoning，不产生新节点', () => {
    const base = buildStandardTree()
    const nodes = editAssistantNode(base, 'R1b', 'b-modified', 'cot')
    expect(nodes.R1b.content).toBe('b-modified')
    expect(nodes.R1b.reasoning).toBe('cot')
    expect(Object.keys(nodes)).toHaveLength(3) // 无新节点
  })
})

describe('删除 → 级联子树', () => {
  it('删除 user 节点连带其全部 AI 回复与后继', () => {
    const base = buildStandardTree()
    // 在 R1a 下延伸一段 U3→R3
    let nodes: NodeMap = base
    nodes = appendTo(nodes, user('U3', 'R1a', 'q', nodes))
    nodes = appendTo(nodes, asst('R3', 'U3', 'r', nodes))

    const after = deleteSubtree(nodes, 'U1')
    expect(collectSubtreeIds(nodes, 'U1')).toEqual(expect.arrayContaining(['U1', 'R1a', 'R1b', 'U3', 'R3']))
    expect(after.U1).toBeUndefined()
    expect(after.R1a).toBeUndefined()
    expect(after.R3).toBeUndefined()
  })
})

describe('deleteRound → 轮次删除（接续后续对话）', () => {
  it('U1→A1→U2→A2→U3→A3：删除 U1 后 U2 提到根层', () => {
    // 构建线性链
    let nodes: NodeMap = {}
    nodes = appendTo(nodes, user('U1', null, '第一问', nodes))
    nodes = appendTo(nodes, asst('A1', 'U1', '第一答', nodes))
    nodes = appendTo(nodes, user('U2', 'A1', '第二问', nodes))
    nodes = appendTo(nodes, asst('A2', 'U2', '第二答', nodes))
    nodes = appendTo(nodes, user('U3', 'A2', '第三问', nodes))
    nodes = appendTo(nodes, asst('A3', 'U3', '第三答', nodes))

    const after = deleteRound(nodes, 'U1')
    // U1 和 A1 被删
    expect(after.U1).toBeUndefined()
    expect(after.A1).toBeUndefined()
    // U2 存活，parentId 变为 null
    expect(after.U2).toBeDefined()
    expect(after.U2.parentId).toBeNull()
    // U2→A2→U3→A3 完整保留
    expect(after.A2.parentId).toBe('U2')
    expect(after.U3.parentId).toBe('A2')
    expect(after.A3.parentId).toBe('U3')
  })

  it('删除中间 user（U2）：U1→A1 保留，U3→A3 挂到 A1 下', () => {
    let nodes: NodeMap = {}
    nodes = appendTo(nodes, user('U1', null, '第一问', nodes))
    nodes = appendTo(nodes, asst('A1', 'U1', '第一答', nodes))
    nodes = appendTo(nodes, user('U2', 'A1', '第二问', nodes))
    nodes = appendTo(nodes, asst('A2', 'U2', '第二答', nodes))
    nodes = appendTo(nodes, user('U3', 'A2', '第三问', nodes))

    const after = deleteRound(nodes, 'U2')
    expect(after.U1).toBeDefined()
    expect(after.A1).toBeDefined()
    expect(after.U2).toBeUndefined()
    expect(after.A2).toBeUndefined()
    expect(after.U3).toBeDefined()
    expect(after.U3.parentId).toBe('A1') // 向上接续
  })

  it('分支场景：删除 U1 不影响 U2 的子树（U2 同级分支完好）', () => {
    // 编辑产生分支：U1 和 U2 都是根节点
    let nodes: NodeMap = {}
    nodes = appendTo(nodes, user('U1', null, '第一问', nodes))
    nodes = appendTo(nodes, asst('A1', 'U1', '第一答', nodes))
    nodes = appendTo(nodes, user('U3', 'A1', '追问', nodes))
    nodes = appendTo(nodes, asst('A3', 'U3', '追问答', nodes))
    // U2 是同父兄弟（编辑 U1 产生），下面有 A2→U4→A4
    nodes = appendTo(nodes, user('U2', null, '第一问改', nodes))
    nodes = appendTo(nodes, asst('A2', 'U2', '第二答', nodes))
    nodes = appendTo(nodes, user('U4', 'A2', '继续', nodes))
    nodes = appendTo(nodes, asst('A4', 'U4', '继续答', nodes))

    const after = deleteRound(nodes, 'U1')
    // U1、A1 被删
    expect(after.U1).toBeUndefined()
    expect(after.A1).toBeUndefined()
    // U3 重新挂到根
    expect(after.U3).toBeDefined()
    expect(after.U3.parentId).toBeNull()
    expect(after.A3.parentId).toBe('U3')
    // U2 的整棵子树完全不受影响
    expect(after.U2).toBeDefined()
    expect(after.U2.parentId).toBeNull()
    expect(after.A2.parentId).toBe('U2')
    expect(after.U4.parentId).toBe('A2')
    expect(after.A4.parentId).toBe('U4')
  })
})

describe('pathToNode 与 resolveInitialPath', () => {
  it('pathToNode 从节点向上到根', () => {
    const nodes = buildStandardTree()
    expect(pathToNode(nodes, 'R1b')).toEqual(['U1', 'R1b'])
  })
  it('resolveInitialPath 沿最近分支走到叶子', () => {
    const nodes = buildStandardTree()
    expect(resolveInitialPath(nodes)).toEqual(['U1', 'R1b']) // versionIndex 最大的子节点
  })
  it('空对话返回空路径', () => {
    expect(resolveInitialPath({})).toEqual([])
  })
})

describe('followLatestBranch', () => {
  it('沿最新子节点走到叶子', () => {
    const base = buildStandardTree()
    expect(followLatestBranch(base, 'U1')).toEqual(['R1b']) // R1b 是 versionIndex 最大的
  })
  it('叶子节点返回空数组', () => {
    const base = buildStandardTree()
    expect(followLatestBranch(base, 'R1b')).toEqual([])
  })
})

describe('切换版本（auto-extend 到叶子）', () => {
  it('切换到同父 AI 版本 → 无子节点，不延伸', () => {
    const base = buildStandardTree()
    const view = switchVersion(base, ['U1', 'R1b'], 'R1a')
    expect(view.path).toEqual(['U1', 'R1a'])
    expect(view.candidates).toEqual([]) // R1a 无子节点
  })

  it('切换到中间节点 → 自动沿最新子链走到叶子', () => {
    // 构建：root → U1 → R1a → U2 → R2, R3(version 2)
    let nodes: NodeMap = {}
    nodes = appendTo(nodes, user('U1', null, 'q1', nodes))
    nodes = appendTo(nodes, asst('R1a', 'U1', 'a1', nodes))
    nodes = appendTo(nodes, user('U2', 'R1a', 'q2', nodes))
    nodes = appendTo(nodes, asst('R2', 'U2', 'a2v1', nodes))
    nodes = appendTo(nodes, asst('R3', 'U2', 'a2v2', nodes))

    // 目前路径：U1→R1a→U2→R3
    const view = switchVersion(nodes, ['U1', 'R1a', 'U2', 'R3'], 'U1')
    // U1 无更深的子节点（只到 R1a），followLatestBranch 从 R1a 走到 R3
    expect(view.path).toEqual(['U1', 'R1a', 'U2', 'R3'])
    expect(view.candidates).toEqual([]) // 已是叶子
  })

  it('编辑后切回旧 user 版本 → 自动沿其最新子链走到叶子', () => {
    // 场景：编辑 U1→U2，path=[U2,R2]，切回 U1
    let nodes = buildStandardTree()
    const edit = editUserNode(nodes, 'U1', 'A\'')
    nodes = edit.nodes
    const u2 = edit.newNodeId
    let p = replyToUser(nodes, [u2], u2)
    nodes = p.nodes

    // 切回 U1 → auto-extend 到 R1b
    const view = switchVersion(nodes, p.path, 'U1')
    expect(view.path).toEqual(['U1', 'R1b'])
    expect(view.tailId).toBe('R1b')
    expect(view.candidates).toEqual([])
  })
})

describe('发送用户消息', () => {
  it('尾部为 assistant → 追加 user 子节点并待回复', () => {
    const base = buildStandardTree()
    const r = sendUserMessage(base, ['U1', 'R1b'], '新问题', CONV)
    expect(r.path).toEqual(['U1', 'R1b', r.pendingUserId])
    expect(r.nodes[r.pendingUserId].role).toBe('user')
    expect(r.nodes[r.pendingUserId].parentId).toBe('R1b')
  })

  it('尾部为 user（等待 AI）→ 不新建节点，返回该 user 触发回复', () => {
    const base = buildStandardTree()
    const r = sendUserMessage(base, ['U1'], '新文本被丢弃', CONV)
    expect(r.pendingUserId).toBe('U1')
    expect(r.path).toEqual(['U1'])
    expect(Object.keys(r.nodes)).toHaveLength(3) // 无新节点
  })

  it('空对话首次发送 → 创建根下 user 节点（conversationId 正确关联）', () => {
    const r = sendUserMessage({}, [], 'hello', 'convA')
    expect(r.path).toHaveLength(1)
    expect(r.nodes[r.pendingUserId].parentId).toBeNull()
    expect(r.nodes[r.pendingUserId].conversationId).toBe('convA') // 修复：不再存空串
  })
})

describe('触发 AI 回复 replyToUser', () => {
  it('为待回复 user 生成 assistant 子节点', () => {
    const r = replyToUser(buildStandardTree(), ['U1'], 'U1')
    expect(r.nodes[r.assistantId].role).toBe('assistant')
    expect(r.nodes[r.assistantId].parentId).toBe('U1')
    expect(r.nodes[r.assistantId].versionIndex).toBe(3) // R1a,R1b 已占 1,2
    expect(r.path).toEqual(['U1', r.assistantId])
  })
})

describe('完整分支场景（先刷新 AI，再修改用户输入）', () => {
  it('编辑 U1→U2 后，切换回 U1 → 自动恢复到 A+b（最新分支）', () => {
    let nodes = buildStandardTree()
    // 编辑 U1 → U2(A')
    const edit = editUserNode(nodes, 'U1', 'A\'')
    nodes = edit.nodes
    // 触发 AI → U2 下生成 c
    let p = replyToUser(nodes, [edit.newNodeId], edit.newNodeId)
    nodes = p.nodes
    expect(p.path).toEqual([edit.newNodeId, p.assistantId])

    // 切回 U1 → 自动沿最新子链走到 R1b（不再需要手动点候选）
    const v1 = switchVersion(nodes, p.path, 'U1')
    expect(v1.path).toEqual(['U1', 'R1b'])
    expect(v1.tailId).toBe('R1b')
    expect(v1.candidates).toEqual([])

    // 旧分支 U2→c 数据保留
    expect(nodes[edit.newNodeId]).toBeDefined()
  })
})
