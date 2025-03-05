"use client";

import { useState } from "react";

const SAMPLE_QUESTIONS = [
  {
    title: "Two Sum",
    difficulty: "Easy",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\n" +
      "You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    starterCode: "function twoSum(nums, target) {\n  // Your code here\n}",
  },
  {
    title: "Valid Parentheses",
    difficulty: "Easy",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\n" +
      "An input string is valid if:\n" +
      "1. Open brackets must be closed by the same type of brackets.\n" +
      "2. Open brackets must be closed in the correct order.\n" +
      "3. Every close bracket has a corresponding open bracket of the same type.",
    examples: [
      {
        input: 's = "()"',
        output: "true",
      },
      {
        input: 's = "()[]{}"',
        output: "true",
      },
      {
        input: 's = "(]"',
        output: "false",
      },
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'.",
    ],
    starterCode: "function isValid(s) {\n  // Your code here\n}",
  },
  {
    title: "Reverse Linked List",
    difficulty: "Easy",
    description:
      "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    examples: [
      {
        input: "head = [1,2,3,4,5]",
        output: "[5,4,3,2,1]",
      },
      {
        input: "head = [1,2]",
        output: "[2,1]",
      },
      {
        input: "head = []",
        output: "[]",
      },
    ],
    constraints: [
      "The number of nodes in the list is the range [0, 5000]",
      "-5000 <= Node.val <= 5000",
    ],
    starterCode:
      "/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n\nfunction reverseList(head) {\n  // Your code here\n}",
  },
];

export default function CodingQuestion({ onSelectStarterCode }) {
  const [currentQuestion, setCurrentQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [isOpen, setIsOpen] = useState(true);

  const handleUseStarterCode = () => {
    if (onSelectStarterCode) {
      onSelectStarterCode(currentQuestion.starterCode);
    }
  };

  const selectRandomQuestion = () => {
    const randomIndex = Math.floor(Math.random() * SAMPLE_QUESTIONS.length);
    setCurrentQuestion(SAMPLE_QUESTIONS[randomIndex]);
  };

  if (!isOpen) {
    return (
      <div className="absolute left-0 top-16 z-10">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-2 rounded-r"
        >
          Show Problem
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-r border-black/[.08] dark:border-white/[.145] relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{currentQuestion.title}</h2>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-sm ${
              currentQuestion.difficulty === "Easy"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : currentQuestion.difficulty === "Medium"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {currentQuestion.difficulty}
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="whitespace-pre-line">{currentQuestion.description}</p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold mb-2">Examples:</h3>
        {currentQuestion.examples.map((example, index) => (
          <div
            key={index}
            className="mb-3 p-3 bg-white dark:bg-[#252525] rounded"
          >
            <p>
              <strong>Input:</strong> {example.input}
            </p>
            <p>
              <strong>Output:</strong> {example.output}
            </p>
            {example.explanation && (
              <p>
                <strong>Explanation:</strong> {example.explanation}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h3 className="font-bold mb-2">Constraints:</h3>
        <ul className="list-disc pl-5">
          {currentQuestion.constraints.map((constraint, index) => (
            <li key={index}>{constraint}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleUseStarterCode}
          className="px-4 py-2 bg-foreground text-background rounded hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Use Starter Code
        </button>
        <button
          onClick={selectRandomQuestion}
          className="px-4 py-2 border border-foreground rounded hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
        >
          New Question
        </button>
      </div>
    </div>
  );
}
