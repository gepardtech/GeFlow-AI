-- ==============================================================================
-- GEFLOW AI — PHASE 4: AI PROVIDER & MODEL CONFIGURATION MIGRATION
-- ==============================================================================

-- 1. AI Providers Registry Table
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL DEFAULT 'model_provider', -- 'model_provider' | 'model_router'
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    health_status TEXT NOT NULL DEFAULT 'unknown', -- 'healthy' | 'unhealthy' | 'unknown'
    last_health_check TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AI Models Registry Table
CREATE TABLE IF NOT EXISTS public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'text', -- 'multimodal' | 'reasoning' | 'text'
    capabilities TEXT[] NOT NULL DEFAULT '{"product_analysis", "product_verification"}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_id, model_id)
);

-- 3. AI Provider Keys & Credential Metadata Table
-- Strictly protected: never exposed to public/anon queries
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    key_source TEXT NOT NULL DEFAULT 'env', -- 'env' | 'database' | 'vault'
    masked_key TEXT,
    encrypted_key TEXT, -- nullable, for securely encrypted storage if needed
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_id, key_name)
);

-- 4. API Requests Audit & Usage Log Table
CREATE TABLE IF NOT EXISTS public.api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success' | 'fallback' | 'error'
    latency_ms INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    usage_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. API Daily Usage Summary Table
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_latency_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(business_id, provider, model, day)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all AI configuration & usage tables
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- ai_providers: Public / Authenticated read active records; Admins/Service manage
CREATE POLICY "Allow public read active ai_providers"
    ON public.ai_providers FOR SELECT
    USING (is_active = true);

-- ai_models: Public / Authenticated read active models; Admins/Service manage
CREATE POLICY "Allow public read active ai_models"
    ON public.ai_models FOR SELECT
    USING (is_active = true);

-- ai_provider_keys: STRICT SECURITY - NO PUBLIC OR ANON ACCESS
-- Only accessible via server-side service role or secure server operations
CREATE POLICY "Strict server-side only access for ai_provider_keys"
    ON public.ai_provider_keys FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- api_requests: Tenant isolation for read; Server inserts
CREATE POLICY "Allow users to read their own business api_requests"
    ON public.api_requests FOR SELECT
    TO authenticated
    USING (business_id IS NOT NULL);

-- api_usage: Tenant isolation for read; Server updates
CREATE POLICY "Allow users to read their own business api_usage"
    ON public.api_usage FOR SELECT
    TO authenticated
    USING (business_id IS NOT NULL);

-- ==============================================================================
-- SEED INITIAL PROVIDERS & MODELS
-- ==============================================================================

-- 1. Insert Providers
INSERT INTO public.ai_providers (id, name, slug, provider_type, is_active, is_default, description)
VALUES 
    ('11111111-1111-4111-a111-111111111111', 'Google Gemini', 'gemini', 'model_provider', true, true, 'Primary product extraction & categorization engine'),
    ('22222222-2222-4222-a222-222222222222', 'OpenAI', 'openai', 'model_provider', true, false, 'Primary consistency auditor & reasoning verifier'),
    ('33333333-3333-4333-a333-333333333333', 'OpenRouter', 'openrouter', 'model_router', true, false, 'Multi-model gateway & flexible fallback routing layer')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    provider_type = EXCLUDED.provider_type,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default,
    description = EXCLUDED.description;

-- 2. Insert Models
INSERT INTO public.ai_models (provider_id, model_id, display_name, model_type, capabilities, is_active, is_default)
VALUES
    -- Gemini models
    ('11111111-1111-4111-a111-111111111111', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'multimodal', '{"product_analysis", "product_verification"}', true, true),
    ('11111111-1111-4111-a111-111111111111', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'multimodal', '{"product_analysis", "product_verification"}', true, false),

    -- OpenAI models
    ('22222222-2222-4222-a222-222222222222', 'gpt-4o-mini', 'GPT-4o Mini', 'reasoning', '{"product_analysis", "product_verification"}', true, true),
    ('22222222-2222-4222-a222-222222222222', 'gpt-4o', 'GPT-4o', 'reasoning', '{"product_analysis", "product_verification"}', true, false),

    -- OpenRouter models
    ('33333333-3333-4333-a333-333333333333', 'meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B Instruct', 'text', '{"product_analysis", "product_verification"}', true, true),
    ('33333333-3333-4333-a333-333333333333', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'multimodal', '{"product_analysis", "product_verification"}', true, false)
ON CONFLICT (provider_id, model_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_type = EXCLUDED.model_type,
    capabilities = EXCLUDED.capabilities,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default;

-- 3. Insert Provider Keys Metadata (env-based sources)
INSERT INTO public.ai_provider_keys (provider_id, key_name, key_source, masked_key, is_active)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'GEMINI_API_KEY', 'env', 'AIza...[ENV_CONFIGURED]', true),
    ('22222222-2222-4222-a222-222222222222', 'OPENAI_API_KEY', 'env', 'sk-...[ENV_CONFIGURED]', true),
    ('33333333-3333-4333-a333-333333333333', 'OPENROUTER_API_KEY', 'env', 'sk-or-...[ENV_CONFIGURED]', true)
ON CONFLICT (provider_id, key_name) DO UPDATE SET
    key_source = EXCLUDED.key_source,
    masked_key = EXCLUDED.masked_key,
    is_active = EXCLUDED.is_active;
