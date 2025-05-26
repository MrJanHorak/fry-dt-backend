import { Profile } from '../models/profile.js'

async function index(req, res) {
  try {
    const profiles = await Profile.find({})
      .populate({
        path: 'students',
        model: 'Profile',
        select: ['name', 'avatar']
      })
      .lean() // Use lean for better performance when we don't need mongoose documents

    res.json(profiles)
  } catch (err) {
    console.error('Index profiles error:', err)
    res.status(500).json({ err: 'Error fetching profiles' })
  }
}

async function show(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findById(req.params.id).populate({
      path: 'students',
      select: ['name', 'avatar', 'practicedWords', 'fryGradelevel', 'tested']
    })

    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    res.status(200).json(profile)
  } catch (err) {
    console.error('Show profile error:', err)
    res.status(500).json({ err: 'Error fetching profile' })
  }
}

async function update(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })

    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    res.status(200).json(profile)
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ err: 'Error updating profile' })
  }
}

async function addPracticedWord(req, res) {
  try {
    if (!req.params.id || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID and word data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    profile.practicedWords.push(req.body)
    await profile.save()

    res.status(200).json(profile.practicedWords)
  } catch (err) {
    console.error('Add practiced word error:', err)
    res.status(500).json({ err: 'Error adding practiced word' })
  }
}

async function updatePracticedWord(req, res) {
  try {
    if (!req.params.id || !req.params.practicedWordId || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID, word ID, and update data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const wordIndex = profile.practicedWords.findIndex((word) =>
      word._id.equals(req.params.practicedWordId)
    )

    if (wordIndex === -1) {
      return res.status(404).json({ err: 'Practiced word not found' })
    }

    profile.practicedWords[wordIndex] = req.body
    await profile.save()

    res.status(200).json(profile.practicedWords[wordIndex])
  } catch (err) {
    console.error('Update practiced word error:', err)
    res.status(500).json({ err: 'Error updating practiced word' })
  }
}

async function removeStudentFromProfile(req, res) {
  try {
    if (!req.params.id || !req.params.studentId) {
      return res
        .status(400)
        .json({ err: 'Profile ID and student ID are required' })
    }

    const profile = await Profile.findById(req.params.id).populate('students')
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const initialLength = profile.students.length
    profile.students = profile.students.filter(
      (student) => student.id !== req.params.studentId
    )

    if (profile.students.length === initialLength) {
      return res.status(404).json({ err: 'Student not found in profile' })
    }

    await profile.save()
    res.status(200).json(profile.students)
  } catch (err) {
    console.error('Remove student error:', err)
    res.status(500).json({ err: 'Error removing student from profile' })
  }
}

export {
  index,
  show,
  update,
  addPracticedWord,
  updatePracticedWord,
  removeStudentFromProfile
}
