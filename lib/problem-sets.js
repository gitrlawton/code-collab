// This file handles loading problem sets from the problem_sets directory

// Import the problem sets directly
import stringsData from "@/problem_sets/foundational/strings.json";
import arraysData from "@/problem_sets/foundational/arrays.json";
import dictionariesData from "@/problem_sets/foundational/dictionaries.json";
import setsData from "@/problem_sets/foundational/sets.json";
import stacksData from "@/problem_sets/foundational/stacks.json";

// Combine all problem sets into a single object
const problemSets = {
  ...stringsData,
  ...arraysData,
  ...dictionariesData,
  ...setsData,
  ...stacksData,
};

/**
 * Get a specific problem from the problem sets
 * @param {string} subject - The subject name (e.g., "Strings & Arrays")
 * @param {string} difficulty - The difficulty level (e.g., "Foundational")
 * @param {string} setNumber - The set number (e.g., "1")
 * @param {number} problemIndex - The index of the problem in the set
 * @returns {Object|null} The problem object or null if not found
 */
export function getProblem(subject, difficulty, setNumber, problemIndex) {
  try {
    const problems = problemSets[subject][difficulty][setNumber].problems;
    if (problems && problems.length > problemIndex) {
      return problems[problemIndex];
    }
    return null;
  } catch (error) {
    console.error("Error getting problem:", error);
    return null;
  }
}

/**
 * Get all problems for a specific problem set
 * @param {string} subject - The subject name (e.g., "Strings & Arrays")
 * @param {string} difficulty - The difficulty level (e.g., "introductory")
 * @param {string} setNumber - The set number (e.g., "1")
 * @returns {Array|null} Array of problem objects or null if not found
 */
export function getProblems(subject, difficulty, setNumber) {
  try {
    return problemSets[subject][difficulty][setNumber].problems || null;
  } catch (error) {
    console.error("Error getting problems:", error);
    return null;
  }
}

/**
 * Get available subjects in the problem sets
 * @returns {Array} Array of subject names
 */
export function getSubjects() {
  return Object.keys(problemSets);
}

/**
 * Get available difficulties for a specific subject
 * @param {string} subject - The subject name
 * @returns {Array} Array of difficulty names
 */
export function getDifficulties(subject) {
  try {
    return Object.keys(problemSets[subject] || {});
  } catch (error) {
    return [];
  }
}

/**
 * Get available set numbers for a specific subject and difficulty
 * @param {string} subject - The subject name
 * @param {string} difficulty - The difficulty level
 * @returns {Array} Array of set numbers
 */
export function getSetNumbers(subject, difficulty) {
  try {
    return Object.keys(problemSets[subject][difficulty] || {});
  } catch (error) {
    return [];
  }
}

export default problemSets;
