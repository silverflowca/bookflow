-- ============================================================================
-- BookFlow Interactive Elements Migration
-- Adds: select, multiselect, textbox, textarea, radio, checkbox, code_block, scripture_block
-- Run: docker exec -i supabase_db_silverflow psql -U postgres -d postgres < "bookflow/migrations/002_interactive_elements.sql"
-- ============================================================================

-- Update the content_type CHECK constraint to include new types
ALTER TABLE bookflow.inline_content
DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
ADD CONSTRAINT inline_content_content_type_check
CHECK (content_type IN (
    'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
    'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
    'code_block', 'scripture_block'
));

-- ============================================================================
-- FORM RESPONSES TABLE (For storing reader responses to interactive elements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL, -- Stores the user's response (selected values, text input, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inline_content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_form_responses_content ON bookflow.form_responses(inline_content_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_user ON bookflow.form_responses(user_id);

-- Enable RLS
ALTER TABLE bookflow.form_responses ENABLE ROW LEVEL SECURITY;

-- Users can see their own responses
CREATE POLICY "form_responses_select" ON bookflow.form_responses FOR SELECT
    USING (user_id = auth.uid());

-- Users can manage their own responses
CREATE POLICY "form_responses_manage" ON bookflow.form_responses FOR ALL
    USING (user_id = auth.uid());

-- Update trigger for form_responses
CREATE TRIGGER update_form_responses_updated_at BEFORE UPDATE ON bookflow.form_responses
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();

-- Grant permissions
GRANT ALL ON bookflow.form_responses TO authenticated;
GRANT ALL ON bookflow.form_responses TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE bookflow.form_responses IS 'User responses to interactive form elements (select, textbox, checkbox, etc.)';

-- ============================================================================
-- CONTENT DATA STRUCTURE REFERENCE (for documentation)
-- ============================================================================
/*
SelectData {
    label: string;              -- Label shown above the select
    placeholder?: string;       -- Placeholder text
    options: { id: string; text: string; }[];  -- Available options
    required?: boolean;         -- Whether response is required
    default_value?: string;     -- Default selected option ID
}

MultiselectData {
    label: string;
    placeholder?: string;
    options: { id: string; text: string; }[];
    required?: boolean;
    min_selections?: number;    -- Minimum selections required
    max_selections?: number;    -- Maximum selections allowed
    default_values?: string[];  -- Default selected option IDs
}

TextboxData {
    label: string;
    placeholder?: string;
    required?: boolean;
    max_length?: number;        -- Maximum character count
    validation_pattern?: string; -- Regex pattern for validation
    default_value?: string;
}

TextareaData {
    label: string;
    placeholder?: string;
    required?: boolean;
    max_length?: number;
    rows?: number;              -- Number of visible rows (default: 4)
    default_value?: string;
}

RadioData {
    label: string;
    options: { id: string; text: string; description?: string; }[];
    required?: boolean;
    default_value?: string;
    layout?: 'vertical' | 'horizontal';  -- How to display options
}

CheckboxData {
    label: string;
    options: { id: string; text: string; description?: string; }[];
    required?: boolean;
    min_selections?: number;
    max_selections?: number;
    default_values?: string[];
    layout?: 'vertical' | 'horizontal';
}

CodeBlockData {
    title?: string;             -- Optional title for the code block
    language: string;           -- Programming language (js, python, sql, etc.)
    code: string;               -- The actual code
    line_numbers?: boolean;     -- Show line numbers (default: true)
    highlight_lines?: number[]; -- Lines to highlight
    caption?: string;           -- Caption below the code block
    editable?: boolean;         -- Whether readers can edit/run code
}

ScriptureBlockData {
    reference: string;          -- e.g., "John 3:16" or "Romans 8:28-30"
    version?: string;           -- Bible version (KJV, NIV, ESV, etc.)
    text: string;               -- The scripture text
    title?: string;             -- Optional title/heading
    notes?: string;             -- Author notes about the scripture
    show_reference?: boolean;   -- Show reference below text (default: true)
}
*/
