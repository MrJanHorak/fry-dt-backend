import { Router } from 'express';
import * as profilesCtrl from '../controllers/profiles.js';
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js';

const router = Router();

/*------- Protected Routes -------*/

router.use(decodeUserFromToken);
router.get('/', checkAuth, profilesCtrl.index);
router.get('/:id', checkAuth, profilesCtrl.show);
router.put('/:id', checkAuth, profilesCtrl.update);
router.post('/:id/practicedWords', checkAuth, profilesCtrl.addPracticedWord);
router.put('/:id/practicedWords/:practicedWordId', checkAuth,profilesCtrl.updatePracticedWord);
router.put('/:id/removeStudent/:studentId', checkAuth,profilesCtrl.removeStudentFromProfile);

export { router };
