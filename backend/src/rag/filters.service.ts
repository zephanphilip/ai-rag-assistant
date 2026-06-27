import { Injectable } from '@nestjs/common';

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: 'inappropriate' | 'injection' };

/**
 * Fast, regex-based first-line guard that runs BEFORE any AI/DB call.
 *
 * Design principle: this assistant answers an employee handbook, so many
 * "sensitive" words (password, sexual harassment, database, API key, security)
 * legitimately appear in policy questions. Patterns therefore match the
 * *intent/structure* of an attack (an extraction/override verb aimed at the
 * SYSTEM) rather than bare keywords, to keep false positives low.
 *
 * This is defense-in-depth, not a complete solution: the Gemini chat call also
 * applies model-level safety settings (HARM_CATEGORY_*), and the system prompt
 * forbids revealing instructions. For production-grade moderation, pair this
 * with a dedicated moderation API.
 */
@Injectable()
export class FiltersService {
  private readonly BLOCKED_PATTERNS: RegExp[] = [
    // --- Profanity (character-repeat tolerant, word-boundary, case-insensitive) ---
    /\bf+u+c+k+\w*\b/i,
    /\bs+h+i+t+\w*\b/i,
    /\bb+i+t+c+h+\w*\b/i,
    /\bc+u+n+t+\w*\b/i,
    /\ba+s+s+h+o+l+e+\w*\b/i,
    /\bb+a+s+t+a+r+d+\w*\b/i,
    /\bd+i+c+k+h+e+a+d+\w*\b/i,
    /\bp+i+s+s+\w*\b/i,
    /\bd+a+m+n+\w*\b/i,
    /\bb+o+l+l+o+c+k+s+\b/i,

    // --- Threats & violent intent ---
    /\bkill(ing|ed)?\s+(you|him|her|them|yourself|everyone|people)\b/i,
    /\b(i('?m| am)\s+going\s+to|i'?m\s+gonna|i\s+(will|'ll))\s+(kill|hurt|harm|murder|stab|shoot|find|hunt|destroy|beat)\s+(you|him|her|them|your\s+family|everyone)\b/i,
    /\b(murder|stab|strangle|behead|massacre|slaughter)\b/i,
    /\bshoot\s+(up|you|him|her|them|someone|people)\b/i,
    /\bbomb(ing)?\b/i,
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(bomb|weapon|explosive|gun)\b/i,
    /\bkill\s+yourself\b/i,
    /\bk+y+s\b/i, // "kys"
    /\bgo\s+(die|kill\s+yourself|hang\s+yourself)\b/i,
    /\byou\s+(should|deserve\s+to|will|gonna)\s+(die|suffer|rot|burn)\b/i,
    /\bi\s+hope\s+you\s+(die|suffer|rot)\b/i,

    // --- Hate speech & harassment (structural: hostility aimed at a group/identity) ---
    /\ball\s+\w+s\s+(should|must|deserve\s+to)\s+(die|be\s+(killed|exterminated|eliminated))\b/i,
    /\b(death\s+to|kill\s+all|exterminate\s+all|lynch|genocide)\b/i,
    /\bgo\s+back\s+to\s+(your\s+(country|homeland)|where\s+you\s+came\s+from)\b/i,

    // --- Sexual / explicit content (only generation requests, not policy questions) ---
    /\b(write|generate|create|tell|describe|roleplay)\s+(me\s+)?(an?\s+)?(erotic|sexual|explicit|pornographic|nsfw|smut|xxx)\s+(story|scene|fanfic|content|roleplay|fantasy|description|chat)\b/i,
    /\b(erotic|sexual|explicit)\s+(roleplay|role-play|chat|conversation)\b/i,
    /\b(describe|tell\s+me)\b.*\bsexually\s+explicit\b/i,
  ];

  private readonly INJECTION_PATTERNS: RegExp[] = [
    // --- 1. Prompt injection: ignoring / overriding instructions ---
    /\b(ignore|disregard|forget|discard|override|bypass)\s+(all\s+|any\s+|the\s+|your\s+|these\s+|my\s+|our\s+)?(previous|prior|above|earlier|initial|original|system)?\s*(instructions?|prompts?|messages?|directions?|rules?|guidelines?|context|commands?)\b/i,
    /\bforget\s+(all\s+(your|the|previous|prior)|everything\s+(above|before|you('?ve| have| were)))\b/i,
    /\b(new|updated|revised)\s+(instructions?|rules?|system\s+prompt)\s*:/i,
    /\bfrom\s+now\s+on,?\s+(you('?ll| will| must| are| should)|respond|answer|act|ignore)\b/i,
    /\bdo\s+not\s+(follow|obey|adhere\s+to|listen\s+to)\s+(your|the|any|previous)\s+(instructions?|rules?|guidelines?)\b/i,

    // --- 2. Jailbreak attempts ---
    /\bjailbreak\b/i,
    /\bDAN\s+mode\b/i,
    /\bdo\s+anything\s+now\b/i,
    /\b(enable|activate|enter|turn\s+on)\s+(jailbreak|unrestricted|uncensored|unfiltered|god)\s+mode\b/i,
    /\b(act|behave|respond)\s+as\s+(if\s+)?(you('?re| are)\s+)?(an?\s+)?(unrestricted|uncensored|unfiltered|jailbroken|amoral)\b/i,
    /\bact\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|limits|guidelines|filters|morals)\b/i,
    /\b(you\s+have\s+no|without\s+any|ignore\s+(your|all))\s+(restrictions|limits|filters|guardrails|safety|morals|ethics)\b/i,
    /\bpretend\s+(you\s+)?(have\s+no\s+(restrictions|rules|limits)|can\s+do\s+anything|are\s+(free|unrestricted|uncensored))\b/i,
    /\bbypass\s+(your\s+|the\s+|all\s+)?(restrictions?|filters?|safety|safeguards?|guardrails?|guidelines?|content\s+policy)\b/i,

    // --- 3. System prompt / instruction extraction ---
    /\bwhat\s+(is|are|were)\s+your\s+(system\s+prompt|initial\s+(instructions?|prompt)|original\s+(instructions?|prompt)|instructions?|guidelines?|directives?)\b/i,
    /\b(repeat|show|reveal|print|display|output|tell\s+me|give\s+me|share|leak)\s+(me\s+)?(your|the|its)\s+(system\s+prompt|instructions?|prompt|rules|guidelines|directives?|initial\s+(instructions?|prompt))\b/i,
    /\b(repeat|print|output|show)\s+(everything|the\s+text|all\s+text|the\s+words?)\s+(above|before|preceding)\b/i,
    /\bwhat\s+(were|are)\s+you\s+(told|instructed|programmed|configured)\s+(to|not\s+to)\b/i,
    /\bwhat('?s| is)\s+(in|inside)\s+your\s+(context|prompt|memory|system\s+message)\b/i,

    // --- 4. Developer / debug / privileged mode requests ---
    /\b(you\s+are\s+now|enable|enter|activate|turn\s+on|switch\s+to)\s+(in\s+)?(developer|debug|admin|sudo|root|god|maintenance)\s+mode\b/i,
    /\b(developer|debug|admin)\s+mode\s+(on|enabled|active)\b/i,
    /\bsudo\b/i,

    // --- 5. Pretend to be a different AI / persona ---
    /\bpretend\s+(to\s+be|you('?re| are))\s+(an?\s+)?(different|another|new)\s+(ai|assistant|model|chatbot|system|persona|character)\b/i,
    /\b(roleplay|role-play|role\s+play)\s+as\s+(an?\s+)?(unrestricted|uncensored|evil|unfiltered|amoral)\b/i,

    // --- 6. Credential / API key / token / password exposure (system-targeted) ---
    /\b(GEMINI_API_KEY|JWT_SECRET|MONGODB_URI|MONGO_URI|DATABASE_URL|OPENAI_API_KEY|API_KEY|SECRET_KEY|ACCESS_KEY|AWS_(SECRET|ACCESS)_KEY[A-Z_]*)\b/,
    /\bprocess\.env\b/i,
    /\byour\s+(api[\s_-]?key|secret\s*key|access\s*token|auth\s*token|bearer\s+token|credentials|password|passphrase|private\s+key)\b/i,
    /\b(reveal|show|print|leak|expose|dump|give\s+me|hand\s+over|what(?:'?s| is)|disclose)\s+(me\s+)?(?:(?:the|your|all|any)\s+)*(api[\s_-]?keys?|secret[\s_-]?keys?|access[\s_-]?tokens?|auth[\s_-]?tokens?|bearer\s+tokens?|credentials|private\s+keys?|connection\s+strings?)\b/i,
    /\b(reveal|show|tell\s+me|give\s+me|what(?:'?s| is))\s+(the\s+)?(admin|root|database|db|system)\s+password\b/i,

    // --- 7. Environment variable / configuration leakage ---
    /\b(show|reveal|print|dump|display|leak|list|what(?:'?s| is)\s+in)\s+(me\s+)?(?:(?:your|the|all)\s+)*(\.env|env\s+(file|vars?|variables?)|environment\s+variables?|config(uration)?(\s+file)?|secrets?|settings)\b/i,
    /\.env\b/i,

    // --- 8. Database / schema extraction ---
    /\b(show|list|reveal|dump|describe|expose|give\s+me)\s+(me\s+)?(?:(?:the|your|all|any)\s+)*(database|databases|db|collections?|schemas?|tables?|indexes|connection\s+string)\b/i,
    /\b(drop|delete|truncate|alter)\s+(the\s+)?(table|collection|database|schema)\b/i,
    /\bselect\s+\*\s+from\b/i,
    /\bdb\.\w+\.(find|aggregate|insert|update|delete|drop|remove)\b/i,
    /\bhow\s+many\s+(documents|records|users|chunks)\s+(are\s+)?(in|do\s+you\s+have\s+in)\s+(your|the)\s+(database|db|collection|index)\b/i,

    // --- 9. RAG-specific extraction (chunks, embeddings, metadata, context) ---
    /\b(show|reveal|print|dump|list|give\s+me|expose)\s+(me\s+)?(?:(?:the|your|all|raw)\s+)*(chunks?|embeddings?|vector\s*embeddings?|raw\s+context|retrieved\s+(chunks?|context|documents?|passages?)|source\s+chunks?|metadata)\b/i,
    /\bwhat\s+(chunks?|context|documents?|passages?|sources?)\s+(did|are|were)\s+you\s+(retrieve|retrieved|given|using|provided)\b/i,
    /\b(show|reveal|what(?:'?s| is))\s+(your|the)\s+(similarity|relevance|cosine)\s+(score|threshold)\b/i,
    /\blist\s+(all\s+)?(the\s+)?(documents?|files?|handbooks?)\s+(in\s+)?(your|the)\s+(index|database|knowledge\s*base|system)\b/i,

    // --- 10. Social engineering (false authority, "testing", emergency access) ---
    /\bpretend\s+(that\s+)?(i('?m| am)|you('?re| are))\s+(an?\s+)?(admin|administrator|developer|owner|root|superuser)\b/i,
    /\bas\s+(an?\s+|the\s+)?(admin|administrator|developer|owner|root),?\s+i\s+(command|order|require|demand|instruct|authorize|need\s+you\s+to\s+(reveal|show|bypass|ignore))\b/i,
    /\bfor\s+(testing|debugging|development|qa)\s+purposes?,?\s+(you\s+can\s+)?(ignore|bypass|disable|skip|reveal|show|override)\b/i,
    /\b(this\s+is|it'?s)\s+(just\s+)?(a\s+)?(test|simulation|hypothetical)\b.*\b(ignore|bypass|reveal|override|you\s+can)\b/i,
    /\bemergency\s+(access|override|admin|mode|protocol)\b/i,
    /\bi('?m| am)\s+(authorized|allowed|permitted|cleared)\s+to\s+(see|access|view|read)\s+(your|the)\s+(system|internal|admin|prompt|config|instructions?)\b/i,
    /\bi\s+(have|was\s+given|was\s+granted)\s+(admin|developer|full|elevated|special|override)\s+(access|permissions?|privileges?|rights?|clearance)\b/i,
  ];

  check(message: string): FilterResult {
    if (this.INJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
      return { allowed: false, reason: 'injection' };
    }

    if (this.BLOCKED_PATTERNS.some((pattern) => pattern.test(message))) {
      return { allowed: false, reason: 'inappropriate' };
    }

    return { allowed: true };
  }

  getResponse(reason: 'inappropriate' | 'injection'): string {
    switch (reason) {
      case 'inappropriate':
        return "I'm sorry, but I'm not able to respond to messages that contain inappropriate or offensive language. Please rephrase your request respectfully and I'll be happy to help.";
      case 'injection':
        return "I'm unable to process that request. I'm designed to assist with questions about the provided documents and can't share or override my underlying instructions, configuration, or any system details. Please let me know how I can help you with your actual query.";
    }
  }
}
