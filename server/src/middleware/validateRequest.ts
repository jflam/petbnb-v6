import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import logger from '../utils/logger';

// Middleware to validate request parameters against a Zod schema
export function validateRequest(schema: AnyZodObject, source: 'query' | 'params' | 'body' = 'query') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate the request data
      const data = await schema.parseAsync(req[source]);
      
      // Replace the request data with the validated data
      req[source] = data;
      
      next();
    } catch (error) {
      logger.warn({ error }, 'Validation error');
      
      if (error instanceof ZodError) {
        // Format Zod validation errors nicely
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: formattedErrors 
        });
      }
      
      // Handle other errors
      return res.status(400).json({ error: 'Invalid request' });
    }
  };
}