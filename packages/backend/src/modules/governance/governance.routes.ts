import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, createProposalSchema, castVoteSchema } from '../../middleware/validation.js';
import { governanceService } from './governance.service.js';

const router = Router();

router.post('/proposals', authenticate, authorize('worker', 'restaurant'), validate(createProposalSchema), async (req: Request, res: Response) => {
  try {
    const result = await governanceService.createProposal({
      proposedBy: req.user!.userId,
      proposerRole: req.user!.role as 'worker' | 'restaurant',
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      parameterChange: req.body.parameterChange,
    });
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create proposal';
    res.status(400).json({ error: message });
  }
});

router.get('/proposals', authenticate, async (_req: Request, res: Response) => {
  try {
    const proposalList = await governanceService.getAllProposals();
    res.json(proposalList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get proposals' });
  }
});

router.get('/proposals/active', authenticate, async (_req: Request, res: Response) => {
  try {
    const activeList = await governanceService.getActiveProposals();
    res.json(activeList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active proposals' });
  }
});

router.get('/proposals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const proposal = await governanceService.getProposal(req.params['id']!);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const voteList = await governanceService.getVotesForProposal(req.params['id']!);
    res.json({ ...proposal, votes: voteList });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get proposal' });
  }
});

router.post('/proposals/:id/vote', authenticate, authorize('worker', 'restaurant'), validate(castVoteSchema), async (req: Request, res: Response) => {
  try {
    const result = await governanceService.castVote(
      req.params['id']!,
      req.user!.userId,
      req.user!.role as 'worker' | 'restaurant',
      req.body.vote,
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cast vote';
    res.status(400).json({ error: message });
  }
});

router.post('/proposals/:id/tally', authenticate, authorize('coop_admin'), async (req: Request, res: Response) => {
  try {
    const result = await governanceService.tallyProposal(req.params['id']!);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to tally proposal';
    res.status(400).json({ error: message });
  }
});

router.get('/parameters', authenticate, async (_req: Request, res: Response) => {
  try {
    const params = await governanceService.getSystemParameters();
    res.json(params);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get system parameters' });
  }
});

export const governanceRoutes = router;
