/**
 * Model Library Routes
 * 
 * Browse, search, and manage AI models available for pumping.
 */

import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Pre-seeded popular models (until database is populated)
const FEATURED_MODELS = [
  // LLMs
  {
    slug: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: 'Meta\'s latest open-weight LLM. Great for chat, coding, and general tasks.',
    category: 'LLM',
    minVramGb: 48,
    recommendedGpu: ['A100 80GB', 'H100 80GB'],
    source: 'ollama',
    sourceId: 'llama3.3:70b',
    isFeatured: true,
  },
  {
    slug: 'qwen-2.5-72b',
    name: 'Qwen 2.5 72B',
    description: 'Alibaba\'s powerful multilingual model. Excels at Chinese and coding.',
    category: 'LLM',
    minVramGb: 48,
    recommendedGpu: ['A100 80GB', 'H100 80GB'],
    source: 'ollama',
    sourceId: 'qwen2.5:72b',
    isFeatured: true,
  },
  {
    slug: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    description: 'DeepSeek\'s reasoning model. Excellent for complex problem solving.',
    category: 'LLM',
    minVramGb: 48,
    recommendedGpu: ['A100 80GB', 'H100 80GB'],
    source: 'ollama',
    sourceId: 'deepseek-r1:70b',
    isFeatured: true,
  },
  {
    slug: 'codestral-22b',
    name: 'Codestral 22B',
    description: 'Mistral\'s code-specialized model. Perfect for programming tasks.',
    category: 'CODE',
    minVramGb: 24,
    recommendedGpu: ['RTX 4090', 'A100 40GB'],
    source: 'ollama',
    sourceId: 'codestral:22b',
    isFeatured: true,
  },
  {
    slug: 'llama-3.2-11b-vision',
    name: 'Llama 3.2 11B Vision',
    description: 'Multimodal model that can understand images and text together.',
    category: 'MULTIMODAL',
    minVramGb: 16,
    recommendedGpu: ['RTX 4090', 'A6000'],
    source: 'ollama',
    sourceId: 'llama3.2-vision:11b',
    isFeatured: true,
  },
  // Smaller models for Starter tier
  {
    slug: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Fast and efficient. Great for quick tasks on smaller GPUs.',
    category: 'LLM',
    minVramGb: 4,
    recommendedGpu: ['RTX 4090', 'RTX 3080'],
    source: 'ollama',
    sourceId: 'llama3.2:3b',
    isFeatured: false,
  },
  {
    slug: 'phi-3-mini',
    name: 'Phi-3 Mini',
    description: 'Microsoft\'s small but mighty model. Surprisingly capable.',
    category: 'LLM',
    minVramGb: 4,
    recommendedGpu: ['RTX 4090', 'RTX 3080'],
    source: 'ollama',
    sourceId: 'phi3:mini',
    isFeatured: false,
  },
  // Image models
  {
    slug: 'stable-diffusion-xl',
    name: 'Stable Diffusion XL',
    description: 'High-quality image generation. Best for creative work.',
    category: 'IMAGE',
    minVramGb: 12,
    recommendedGpu: ['RTX 4090', 'A6000'],
    source: 'huggingface',
    sourceId: 'stabilityai/stable-diffusion-xl-base-1.0',
    isFeatured: true,
  },
  {
    slug: 'flux-1-dev',
    name: 'FLUX.1 Dev',
    description: 'Black Forest Labs\' flagship image model. Exceptional quality.',
    category: 'IMAGE',
    minVramGb: 24,
    recommendedGpu: ['RTX 4090', 'A100 40GB'],
    source: 'huggingface',
    sourceId: 'black-forest-labs/FLUX.1-dev',
    isFeatured: true,
  },
]

// GET /api/models - List available models (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, featured, minVram, search, limit = '50', offset = '0' } = req.query
    
    // Try database first
    let models: any[] = []
    let total = 0
    
    try {
      const where: any = { isPublic: true }
      if (category) where.category = category.toString().toUpperCase()
      if (featured === 'true') where.isFeatured = true
      if (minVram) where.minVramGb = { lte: parseInt(minVram.toString()) }
      if (search) {
        where.OR = [
          { name: { contains: search.toString(), mode: 'insensitive' } },
          { description: { contains: search.toString(), mode: 'insensitive' } },
        ]
      }
      
      models = await prisma.model.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { downloadCount: 'desc' }],
        take: parseInt(limit.toString()),
        skip: parseInt(offset.toString()),
      })
      
      total = await prisma.model.count({ where })
    } catch (e) {
      // Database not ready, use featured models
      console.log('[models] Using featured models (database not ready)')
    }
    
    // Fall back to featured models if database empty
    if (models.length === 0) {
      let filtered = [...FEATURED_MODELS]
      
      if (category) {
        filtered = filtered.filter(m => m.category === category.toString().toUpperCase())
      }
      if (featured === 'true') {
        filtered = filtered.filter(m => m.isFeatured)
      }
      if (minVram) {
        filtered = filtered.filter(m => m.minVramGb <= parseInt(minVram.toString()))
      }
      if (search) {
        const q = search.toString().toLowerCase()
        filtered = filtered.filter(m => 
          m.name.toLowerCase().includes(q) || 
          m.description.toLowerCase().includes(q)
        )
      }
      
      models = filtered.slice(
        parseInt(offset.toString()),
        parseInt(offset.toString()) + parseInt(limit.toString())
      )
      total = filtered.length
    }
    
    res.json({
      models: models.map(m => ({
        slug: m.slug,
        name: m.name,
        description: m.description,
        category: m.category,
        minVramGb: m.minVramGb,
        recommendedGpu: m.recommendedGpu,
        source: m.source,
        isFeatured: m.isFeatured,
      })),
      total,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString()),
      categories: ['LLM', 'IMAGE', 'AUDIO', 'VIDEO', 'CODE', 'MULTIMODAL'],
    })
  } catch (error) {
    console.error('List models error:', error)
    res.status(500).json({ error: 'Failed to list models' })
  }
})

// GET /api/models/featured - Get featured models (public)
router.get('/featured', async (req: Request, res: Response) => {
  try {
    // Try database first
    let models: any[] = []
    
    try {
      models = await prisma.model.findMany({
        where: { isFeatured: true, isPublic: true },
        orderBy: { downloadCount: 'desc' },
        take: 10,
      })
    } catch (e) {
      // Database not ready
    }
    
    // Fall back to featured models
    if (models.length === 0) {
      models = FEATURED_MODELS.filter(m => m.isFeatured)
    }
    
    res.json({
      models: models.map(m => ({
        slug: m.slug,
        name: m.name,
        description: m.description,
        category: m.category,
        minVramGb: m.minVramGb,
        recommendedGpu: m.recommendedGpu,
      })),
      message: 'Featured models ready to pump! 🚀',
    })
  } catch (error) {
    console.error('Get featured models error:', error)
    res.status(500).json({ error: 'Failed to get featured models' })
  }
})

// GET /api/models/categories - List model categories (public)
router.get('/categories', (req: Request, res: Response) => {
  res.json({
    categories: [
      { id: 'LLM', name: 'Large Language Models', description: 'Chat, writing, coding assistants' },
      { id: 'IMAGE', name: 'Image Generation', description: 'Create images from text prompts' },
      { id: 'CODE', name: 'Code Models', description: 'Specialized for programming' },
      { id: 'MULTIMODAL', name: 'Multimodal', description: 'Understand images and text together' },
      { id: 'AUDIO', name: 'Audio Models', description: 'Speech, music, sound generation' },
      { id: 'VIDEO', name: 'Video Models', description: 'Video generation and editing' },
    ],
  })
})

// GET /api/models/:slug - Get model details (public)
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    
    // Try database first
    let model: any = null
    
    try {
      model = await prisma.model.findUnique({
        where: { slug },
      })
    } catch (e) {
      // Database not ready
    }
    
    // Fall back to featured models
    if (!model) {
      model = FEATURED_MODELS.find(m => m.slug === slug)
    }
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' })
    }
    
    res.json({
      model: {
        slug: model.slug,
        name: model.name,
        description: model.description,
        category: model.category,
        minVramGb: model.minVramGb,
        recommendedGpu: model.recommendedGpu,
        source: model.source,
        sourceId: model.sourceId,
        isFeatured: model.isFeatured,
        downloadCount: model.downloadCount || 0,
      },
    })
  } catch (error) {
    console.error('Get model error:', error)
    res.status(500).json({ error: 'Failed to get model' })
  }
})

// GET /api/models/:slug/compatible-tiers - Get compatible GPU tiers for a model
router.get('/:slug/compatible-tiers', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    
    // Find model
    let model: any = null
    
    try {
      model = await prisma.model.findUnique({ where: { slug } })
    } catch (e) {
      // Database not ready
    }
    
    if (!model) {
      model = FEATURED_MODELS.find(m => m.slug === slug)
    }
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' })
    }
    
    // Determine compatible tiers based on VRAM requirement
    const tiers: { id: string; name: string; compatible: boolean; reason?: string }[] = []
    
    if (model.minVramGb <= 24) {
      tiers.push({ id: 'starter', name: 'Starter', compatible: true })
    } else {
      tiers.push({ id: 'starter', name: 'Starter', compatible: false, reason: `Requires ${model.minVramGb}GB VRAM` })
    }
    
    if (model.minVramGb <= 48) {
      tiers.push({ id: 'pro', name: 'Pro', compatible: true })
    } else {
      tiers.push({ id: 'pro', name: 'Pro', compatible: false, reason: `Requires ${model.minVramGb}GB VRAM` })
    }
    
    // Beast and Ultra can run anything
    tiers.push({ id: 'beast', name: 'Beast', compatible: true })
    tiers.push({ id: 'ultra', name: 'Ultra', compatible: true })
    
    res.json({
      model: model.slug,
      minVramGb: model.minVramGb,
      tiers,
      recommended: model.recommendedGpu,
    })
  } catch (error) {
    console.error('Get compatible tiers error:', error)
    res.status(500).json({ error: 'Failed to get compatible tiers' })
  }
})

export default router
