# Improved Editing System Implementation Plan

## Overview

This plan implements all three ideas for improving the thesis editing system:
1. **Paragraph-Level Understanding**: Extract paragraph summaries and use them for better edit targeting
2. **Iterative Reasoning**: Separate reasoning phase from action phase with iterative reading
3. **Global Review Agent**: Validate edits for coherence and consistency before applying

## Architecture

```
User Request
    ↓
[Phase 1: Paragraph Analysis]
    ├─ Detect paragraphs in thesis
    ├─ Extract summaries (cached)
    └─ Identify relevant paragraphs via similarity
    ↓
[Phase 2: Iterative Reasoning]
    ├─ Generate reading plan
    ├─ Execute read commands (max 3 iterations)
    └─ Accumulate context
    ↓
[Phase 3: Edit Proposal]
    ├─ Generate edit proposal with paragraph context
    └─ Include reasoning from Phase 2
    ↓
[Phase 4: Review Agent]
    ├─ Check coherence, consistency, style
    ├─ Classify issues (blocker/warning/nit)
    └─ Generate review verdict
    ↓
[Phase 5: Apply Edit]
    ├─ Use paragraph boundaries for better matching
    └─ Apply with improved location targeting
```

## Implementation Steps

### Step 1: Paragraph Detection and Analysis Module

**File**: `local-desktop-agent/main.js`

**New Functions**:
- `detectParagraphs(thesisContent)`: Parse HTML/text to identify paragraph boundaries
- `extractParagraphSummaries(paragraphs, apiKey)`: Generate summaries for paragraphs (with caching)
- `findRelevantParagraphs(userRequest, paragraphs, summaries)`: Use embeddings to find relevant paragraphs

**Key Features**:
- Detect paragraphs from HTML (`<p>`, `<div>`) and plain text (double line breaks)
- Cache paragraph summaries with content hash
- Use embeddings for semantic similarity matching
- Store paragraph metadata (index, start/end position, summary, embedding)

**Schema**:
```javascript
{
  paragraphs: [
    {
      index: 0,
      text: "...",
      summary: "...",
      embedding: [...],
      startPos: 0,
      endPos: 150,
      htmlElement: <p>...</p> // if available
    }
  ]
}
```

### Step 2: Iterative Reasoning Module

**File**: `local-desktop-agent/main.js`

**New Functions**:
- `reasonAboutEdit(userRequest, thesisContent, paragraphs, loadedContexts, apiKey)`: Main reasoning loop
- `generateReadingPlan(userRequest, paragraphs, summaries, apiKey)`: Generate reading plan
- `executeReadCommand(readCommand, paragraphs, thesisContent)`: Execute a read command
- `shouldContinueReasoning(accumulatedContext, iteration, maxIterations)`: Decide if more reasoning needed

**Key Features**:
- Max 3 iterations with early stopping
- Structured reading plan format
- Accumulate context across iterations
- Skip reasoning for simple edits (detected heuristically)

**Reading Plan Schema**:
```javascript
{
  reasoning: "To add information about X, I need to...",
  steps: [
    {
      target: { type: "paragraph", index: 2 },
      reason: "Check if X is already mentioned"
    },
    {
      target: { type: "sentence", paragraphIndex: 3, sentenceIndex: 5 },
      reason: "Verify context around Y"
    }
  ],
  nextAction: "read" | "edit" | "clarify",
  confidence: 0.8
}
```

### Step 3: Enhanced Edit Proposal Generation

**File**: `local-desktop-agent/main.js`

**Modify**: `proposeThesisEdit` handler

**Changes**:
- Accept paragraph analysis results
- Include paragraph summaries in prompt
- Use paragraph context for better location targeting
- Include reasoning from iterative phase
- Add `editScope` field: "single_paragraph" | "multi_paragraph" | "sentence"

**Enhanced Schema**:
```javascript
{
  type: "edit",
  description: "...",
  reasoning: "...", // From iterative reasoning phase
  editScope: "single_paragraph",
  changes: [
    {
      action: "replace",
      paragraphIndex: 2, // NEW: paragraph index
      searchText: "...",
      newText: "...",
      locationContext: "...",
      surroundingText: "...",
      reasoning: "Because paragraph 3 already defines X..." // NEW: per-change reasoning
    }
  ]
}
```

### Step 4: Review Agent Module

**File**: `local-desktop-agent/main.js`

**New Functions**:
- `reviewEditProposal(proposal, thesisContent, paragraphs, apiKey)`: Main review function
- `checkCoherence(proposal, thesisContent)`: Check document flow
- `checkConsistency(proposal, thesisContent)`: Check for contradictions
- `checkStyle(proposal, thesisContent)`: Check writing style match

**Review Schema**:
```javascript
{
  approved: true,
  confidence: 0.9,
  issues: [
    {
      type: "coherence" | "consistency" | "style" | "scope",
      severity: "blocker" | "warning" | "nit",
      description: "...",
      suggestion: "..."
    }
  ],
  suggestions: ["Consider adding transition sentence..."],
  overallVerdict: "approve" | "reject" | "approve_with_suggestions"
}
```

**Key Features**:
- Check coherence (flow, transitions)
- Check consistency (no contradictions)
- Check style match (writing style similarity)
- Check scope (edit doesn't introduce unrelated content)
- Classify issues by severity
- Non-blocking: warnings/nits don't prevent application

### Step 5: Enhanced Edit Application

**File**: `local-desktop-agent/renderer.js`

**Modify**: `applyBasicEdit` function

**Changes**:
- Use paragraph boundaries for better text matching
- Prioritize paragraph-index-based location if available
- Fall back to current matching strategies
- Show paragraph context in UI

**New Helper Functions**:
- `findParagraphByIndex(index)`: Find paragraph DOM element by index
- `findTextInParagraph(paragraph, searchText)`: Search within specific paragraph
- `applyEditToParagraph(paragraph, change)`: Apply edit to specific paragraph

### Step 6: UI Updates

**File**: `local-desktop-agent/agent.js`

**Modify**: `displayEditProposal` function

**Changes**:
- Show paragraph context in proposal display
- Show reasoning from iterative phase
- Show review results (if any issues)
- Display review verdict prominently
- Add "Apply Anyway" option if review has warnings

**New UI Elements**:
- Reasoning section in modal
- Review verdict badge (✅/⚠️/❌)
- Issue list with severity indicators
- Paragraph context display

### Step 7: Caching and Performance

**File**: `local-desktop-agent/main.js`

**New Functions**:
- `getCachedParagraphSummaries(thesisContentHash)`: Load cached summaries
- `saveParagraphSummaries(thesisContentHash, summaries)`: Save summaries to cache
- `computeThesisHash(thesisContent)`: Compute content hash for cache key

**Cache Structure**:
- Store in `local-desktop-agent/data/paragraph_cache/`
- File: `{hash}.json`
- Include: summaries, embeddings, paragraph metadata

### Step 8: Configuration and Controls

**File**: `local-desktop-agent/main.js`

**New Configuration**:
- `MAX_REASONING_ITERATIONS = 3`
- `ENABLE_REASONING = true` (can be disabled for simple edits)
- `ENABLE_REVIEW = true` (can be disabled)
- `REVIEW_BLOCKING = false` (review is advisory by default)

**Heuristics**:
- Skip reasoning if edit request is < 20 chars (likely simple fix)
- Skip reasoning if user request contains "fix typo" or "correct spelling"
- Always enable review for multi-paragraph edits

## File Changes Summary

### New Files
- None (all functionality added to existing files)

### Modified Files

1. **`local-desktop-agent/main.js`**
   - Add paragraph detection and analysis functions
   - Add iterative reasoning functions
   - Enhance `proposeThesisEdit` handler
   - Add review agent functions
   - Add caching functions

2. **`local-desktop-agent/renderer.js`**
   - Enhance `applyBasicEdit` to use paragraph boundaries
   - Add paragraph-based matching functions

3. **`local-desktop-agent/agent.js`**
   - Update `displayEditProposal` to show reasoning and review
   - Add UI for review verdict and issues

4. **`local-desktop-agent/styles/main.css`**
   - Add styles for reasoning section
   - Add styles for review verdict badges
   - Add styles for issue severity indicators

## Implementation Order

1. **Phase 1**: Paragraph Detection (Step 1)
   - Foundation for everything else
   - Can be tested independently

2. **Phase 2**: Enhanced Edit Proposal (Step 3)
   - Use paragraph context in proposals
   - Immediate improvement to matching

3. **Phase 3**: Iterative Reasoning (Step 2)
   - Add reasoning phase before proposal
   - Integrate with existing proposal flow

4. **Phase 4**: Review Agent (Step 4)
   - Add validation after proposal
   - Integrate with UI

5. **Phase 5**: Enhanced Application (Step 5)
   - Use paragraph boundaries for matching
   - Improve edit application accuracy

6. **Phase 6**: UI Updates (Step 6)
   - Show reasoning and review in UI
   - Improve user experience

7. **Phase 7**: Caching (Step 7)
   - Optimize performance
   - Reduce API costs

8. **Phase 8**: Configuration (Step 8)
   - Add controls and heuristics
   - Fine-tune behavior

## Testing Strategy

1. **Unit Tests** (if test framework exists):
   - Paragraph detection accuracy
   - Summary extraction quality
   - Reading plan generation
   - Review agent logic

2. **Integration Tests**:
   - End-to-end edit flow
   - Caching behavior
   - Error handling

3. **Manual Testing**:
   - Test with various thesis content
   - Test with different edit types
   - Verify UI updates
   - Check performance

## Success Metrics

- **Accuracy**: % of edits applied at correct location (target: >90%)
- **User Satisfaction**: % of edits user accepts without modification (target: >80%)
- **Latency**: Average time per edit (target: <10s for complex edits)
- **Cost**: Average LLM calls per edit (target: <5 calls)

## Rollback Plan

- Each phase can be disabled via configuration flags
- Can revert to original `proposeThesisEdit` if needed
- Caching is optional and can be disabled

## Notes

- All LLM calls use `gemini-2.5-flash` for speed
- Caching reduces redundant API calls
- Iterative reasoning has hard limits to prevent loops
- Review agent is advisory (non-blocking) by default
- Paragraph detection handles both HTML and plain text
