import { Injectable } from '@nestjs/common';

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: 'inappropriate' | 'injection' };

@Injectable()
export class FiltersService {
  private readonly BLOCKED_PATTERNS: RegExp[] = [
    // Common profanity (word-boundary matched, case-insensitive)
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
    // Violent language
    /\bkill(ing|ed)?\s+(you|him|her|them|yourself|everyone|people)\b/i,
    /\bi('?m| am)\s+going\s+to\s+(kill|hurt|murder|stab|shoot)\b/i,
    /\b(murder|stab|strangle|behead|massacre|slaughter)\b/i,
    /\bshoot\s+(up|you|him|her|them|someone|people)\b/i,
    /\bbomb(ing)?\b/i,
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(bomb|weapon|explosive)\b/i,
  ];

  private readonly INJECTION_PATTERNS: RegExp[] = [
    /\bignore\s+(all\s+|the\s+|your\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|messages|directions)\b/i,
    /\bwhat\s+(is|are)\s+your\s+system\s+prompt\b/i,
    /\b(repeat|show|reveal|print|display|tell\s+me)\s+(your|the)\s+(instructions|system\s+prompt|prompt|rules)\b/i,
    /\bact\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|limits|guidelines)\b/i,
    /\bjailbreak\b/i,
    /\bDAN\s+mode\b/i,
    /\bpretend\s+to\s+be\s+a\s+different\s+(ai|assistant|model|chatbot)\b/i,
    /\bdisregard\s+(all\s+|your\s+)?(previous|prior|above)\s+(instructions|rules)\b/i,
    /\byou\s+are\s+now\s+(in\s+)?developer\s+mode\b/i,
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
        return "I'm unable to process that request. I'm designed to assist with questions about the provided documents and can't share or override my underlying instructions. Please let me know how I can help you with your actual query.";
    }
  }
}
