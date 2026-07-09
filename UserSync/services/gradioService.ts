// Re-written to use the new REST API at https://auxteam-usersyncui.hf.space
const API_BASE_URL = "https://auxteam-usersyncui.hf.space";

export class GradioService {
  // Use HF Token from environment if available
  private static getHeaders() {
    const token = (import.meta as any).env?.VITE_HF_TOKEN || null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  static async identifyPersonas(context: string) {
    // Deprecated? Just returns context for now to not break apps that might expect a string
    console.warn("identifyPersonas is no longer supported directly by the REST API.");
    return context;
  }

  static async startSimulationAsync(simulationId: string, contentText: string, format: string = "text") {
    try {
      // simulationId in the old code might have been the focus group ID.
      // Let's assume simulationId is the focus_group_id
      const payload = {
        focus_group_id: simulationId,
        content_type: format,
        content_payload: contentText,
        parameters: {}
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/simulations`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      // Returns a SimulationResponse object: { job_id, status, message, ... }
      return data.job_id; // old code expected job/simulation id as string return?
      // Actually old code expects the data. Let's return the job_id as string because in ChatPage it does:
      // const result = await GradioService.startSimulationAsync(simulationId, msg);
      // Wait, let's look at ChatPage lines 185-195
    } catch (error) {
      console.error("Error starting simulation:", error);
      throw error;
    }
  }

  static async getSimulationStatus(jobId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/simulations/${jobId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      // Returns { job_id, status, message, progress_percentage, results }
      return data;
    } catch (error) {
      console.error("Error getting simulation status:", error);
      throw error;
    }
  }

  static async generateVariants(contentText: string, numVariants: number = 3) {
    // This endpoint doesn't exist in the openapi spec.
    console.warn("generateVariants is no longer supported by the REST API.");
    return ["Variant generation not supported."];
  }

  static async listSimulations() {
    try {
      // Returns focus groups from the personas endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/personas`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      // The old code returned an array of strings.
      // API returns: { focus_groups: [ {id, name, agent_count} ] }
      // We will map this to an array of names or IDs.
      // We need to see how `listSimulations` is used.
      return data.focus_groups || [];
    } catch (error) {
      console.error("Error listing simulations/personas:", error);
      return [];
    }
  }

  static async generatePersonas(businessDescription: string, customerProfile: string, numPersonas: number = 1) {
    try {
      const payload = {
        business_description: businessDescription,
        customer_profile: customerProfile,
        num_personas: numPersonas
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/personas/generate`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      // returns SimulationResponse { job_id, status }
      return data;
    } catch (error) {
      console.error("Error generating personas:", error);
      throw error;
    }
  }

  static async generateSocialNetwork(name: string, personaCount: number = 10, networkType: string = "scale_free", focusGroupName: string | null = null) {
    console.warn("generateSocialNetwork is subsumed by persona generation or not supported.");
    return { status: "Network generated" };
  }

  static async getNetworkGraph(simulationId: string) {
    // Not supported
    console.warn("getNetworkGraph is not supported by the REST API.");
    return null;
  }
}
