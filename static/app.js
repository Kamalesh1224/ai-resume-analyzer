const fileInput = document.querySelector("[data-file-input]");
const fileName = document.querySelector("[data-file-name]");
const dropzone = document.querySelector("[data-file-dropzone]");
const printButton = document.querySelector("[data-print-report]");
const candidateTargets = Array.from(document.querySelectorAll("[data-candidate-target]"));
const candidateRows = Array.from(document.querySelectorAll(".candidate-table-row[data-candidate-target]"));
const candidateDetails = Array.from(document.querySelectorAll("[data-candidate-detail]"));
const scoreFilterInput = document.querySelector("[data-filter-score]");
const experienceFilterInput = document.querySelector("[data-filter-experience]");
const clearFiltersButton = document.querySelector("[data-clear-filters]");
const filterSummary = document.querySelector("[data-filter-summary]");
const filterEmptyState = document.querySelector("[data-filter-empty]");
const exportPayloadElement = document.querySelector("[data-export-payload]");
const exportCsvButton = document.querySelector("[data-export-csv]");
const exportExcelButton = document.querySelector("[data-export-excel]");
const exportCandidates = exportPayloadElement ? JSON.parse(exportPayloadElement.textContent || "[]") : [];

if (fileInput && fileName && dropzone) {
  const updateFileName = () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) {
      fileName.textContent = "No file selected";
      return;
    }

    if (files.length === 1) {
      fileName.textContent = files[0].name;
      return;
    }

    const previewNames = files.slice(0, 2).map((file) => file.name).join(", ");
    const additionalCount = files.length - 2;
    fileName.textContent = additionalCount > 0
      ? `${files.length} resumes selected: ${previewNames}, +${additionalCount} more`
      : `${files.length} resumes selected: ${previewNames}`;
  };

  fileInput.addEventListener("change", updateFileName);
  fileInput.addEventListener("focus", () => dropzone.classList.add("is-active"));
  fileInput.addEventListener("blur", () => dropzone.classList.remove("is-active"));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      fileInput.files = files;
      updateFileName();
    }
  });
}

if (printButton) {
  printButton.addEventListener("click", () => {
    window.print();
  });
}

if (candidateRows.length && candidateDetails.length) {
  let activeTargetId = null;

  const getVisibleRows = () => candidateRows.filter((row) => !row.hidden);
  const getVisibleCandidateIds = () => new Set(getVisibleRows().map((row) => row.dataset.candidateTarget));
  const getVisibleExportCandidates = () => exportCandidates.filter((candidate) => getVisibleCandidateIds().has(candidate.target_id));

  const downloadBlob = (content, fileName, contentType) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const escapeCsvValue = (value) => {
    const stringValue = Array.isArray(value) ? value.join(", ") : `${value ?? ""}`;
    const escaped = stringValue.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  };

  const escapeHtmlValue = (value) => `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const getExportRows = () => {
    const visibleCandidates = getVisibleExportCandidates();
    return visibleCandidates.map((candidate) => ({
      Rank: candidate.rank,
      Candidate: candidate.candidate_name,
      Filename: candidate.filename,
      "ATS Score": `${candidate.ats_score}%`,
      "Score Label": candidate.score_label,
      Experience: candidate.experience_display,
      "Requirement Match": `${candidate.coverage_percent}%`,
      "Section Evidence": `${candidate.evidence_strength_percent}%`,
      "ATS Readiness": `${candidate.ats_readiness_percent}%`,
      "Matched Skills": candidate.matched_skills.join(", "),
      "Missing Skills": candidate.missing_skills.join(", "),
      "Matched Keywords": candidate.matched_keywords.join(", "),
      "Missing Keywords": candidate.missing_keywords.join(", "),
      Summary: candidate.summary,
    }));
  };

  const exportCurrentView = (format) => {
    const rows = getExportRows();
    if (!rows.length) {
      window.alert("No visible candidates are available to export.");
      return;
    }

    const dateLabel = new Date().toISOString().slice(0, 10);
    const headers = Object.keys(rows[0]);

    if (format === "csv") {
      const csvContent = [
        headers.map((header) => escapeCsvValue(header)).join(","),
        ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
      ].join("\n");
      downloadBlob(csvContent, `resume_match_results_${dateLabel}.csv`, "text/csv;charset=utf-8");
      return;
    }

    const tableRows = rows.map(
      (row) => `<tr>${headers.map((header) => `<td>${escapeHtmlValue(row[header])}</td>`).join("")}</tr>`,
    ).join("");
    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; }
            th, td { border: 1px solid #c8d0da; padding: 8px; vertical-align: top; }
            th { background: #e9eef5; font-weight: 700; }
          </style>
        </head>
        <body>
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeHtmlValue(header)}</th>`).join("")}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `.trim();
    downloadBlob(workbook, `resume_match_results_${dateLabel}.xls`, "application/vnd.ms-excel;charset=utf-8");
  };

  const setActiveCandidate = (targetId) => {
    activeTargetId = targetId || null;
    const visibleTargets = new Set(getVisibleRows().map((row) => row.dataset.candidateTarget));

    candidateRows.forEach((row) => {
      const isActive = !row.hidden && row.dataset.candidateTarget === activeTargetId;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    candidateDetails.forEach((detail) => {
      const isActive = visibleTargets.has(detail.dataset.candidateDetail) && detail.dataset.candidateDetail === activeTargetId;
      detail.classList.toggle("is-active", isActive);
      detail.hidden = !isActive;
    });
  };

  const updateFilters = () => {
    const minimumScore = Number.parseFloat(scoreFilterInput?.value || "0") || 0;
    const minimumExperience = Number.parseFloat(experienceFilterInput?.value || "0") || 0;

    candidateRows.forEach((row) => {
      const candidateScore = Number.parseFloat(row.dataset.score || "0") || 0;
      const candidateExperience = Number.parseFloat(row.dataset.experience || "0") || 0;
      const matches = candidateScore >= minimumScore && candidateExperience >= minimumExperience;
      row.hidden = !matches;
    });

    const visibleRows = getVisibleRows();
    const nextTargetId = visibleRows.some((row) => row.dataset.candidateTarget === activeTargetId)
      ? activeTargetId
      : visibleRows[0]?.dataset.candidateTarget || null;

    setActiveCandidate(nextTargetId);

    if (filterSummary) {
      filterSummary.textContent = visibleRows.length === candidateRows.length
        ? `Showing all ${visibleRows.length} candidates`
        : `Showing ${visibleRows.length} of ${candidateRows.length} candidates`;
    }

    if (filterEmptyState) {
      filterEmptyState.hidden = visibleRows.length > 0;
    }
  };

  const initialRow = candidateRows.find((row) => row.classList.contains("is-active")) || candidateRows[0];
  if (initialRow) {
    setActiveCandidate(initialRow.dataset.candidateTarget);
  }

  candidateTargets.forEach((target) => {
    target.addEventListener("click", (event) => {
      const targetId = target.dataset.candidateTarget;
      if (!targetId) {
        return;
      }

      if (target.tagName === "BUTTON") {
        event.stopPropagation();
      }

      setActiveCandidate(targetId);
    });

    if (target.tagName === "TR") {
      target.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        const targetId = target.dataset.candidateTarget;
        if (targetId) {
          setActiveCandidate(targetId);
        }
      });
    }
  });

  if (scoreFilterInput) {
    scoreFilterInput.addEventListener("input", updateFilters);
  }

  if (experienceFilterInput) {
    experienceFilterInput.addEventListener("input", updateFilters);
  }

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", () => {
      if (scoreFilterInput) {
        scoreFilterInput.value = "0";
      }
      if (experienceFilterInput) {
        experienceFilterInput.value = "0";
      }
      updateFilters();
    });
  }

  if (exportCsvButton) {
    exportCsvButton.addEventListener("click", () => exportCurrentView("csv"));
  }

  if (exportExcelButton) {
    exportExcelButton.addEventListener("click", () => exportCurrentView("excel"));
  }

  updateFilters();
}
