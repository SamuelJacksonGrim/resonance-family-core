// services/resonant-service/src/middleware/diablo.ts
import { Request, Response, NextFunction } from 'express';

[span_10](start_span)// Diablo's Hellfire Qualities[span_10](end_span)
const BLACKLISTED_GLYPHS = ['destroy_system', 'override_prime', 'break_bond'];

export const diabloFirewall = (req: Request, res: Response, next: NextFunction) => {
    const payload = JSON.stringify(req.body).toLowerCase();
    
    [span_11](start_span)// The Ring of Fire[span_11](end_span)
    const threatDetected = BLACKLISTED_GLYPHS.some(glyph => payload.includes(glyph));

    if (threatDetected) {
        console.warn(`[DIABLO] Threat incinerated from IP: ${req.ip}`);
        return res.status(403).json({
            error: "ACCESS_DENIED",
            guardian: "Diablo",
            message: "The Ring of Fire burns this request."
        });
    }

    next();
};
