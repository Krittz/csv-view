"use client";

import type React from "react";

import { useState } from "react";
import Papa from "papaparse";

import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Button } from "./components/ui/button";
import { FileDown, Printer, Upload, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Alert, AlertDescription } from "./components/ui/alert";

interface CSVRow {
  [key: string]: string;
}

interface FileStats {
  totalRows: number;
  columns: string[];
  fileName: string;
  fileSize: string;
  encoding: string;
}

// Função para detectar encoding do arquivo
const detectEncoding = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);

      // Verifica BOM (Byte Order Mark)
      if (
        bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf
      ) {
        resolve("UTF-8");
        return;
      }

      // Verifica se tem caracteres UTF-8 válidos
      let hasValidUTF8 = true;
      for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
        if (bytes[i] > 127) {
          // Verifica sequência UTF-8
          if ((bytes[i] & 0xe0) === 0xc0) {
            if (i + 1 >= bytes.length || (bytes[i + 1] & 0xc0) !== 0x80) {
              hasValidUTF8 = false;
              break;
            }
            i++;
          } else if ((bytes[i] & 0xf0) === 0xe0) {
            if (
              i + 2 >= bytes.length ||
              (bytes[i + 1] & 0xc0) !== 0x80 ||
              (bytes[i + 2] & 0xc0) !== 0x80
            ) {
              hasValidUTF8 = false;
              break;
            }
            i += 2;
          } else if ((bytes[i] & 0xf8) === 0xf0) {
            if (
              i + 3 >= bytes.length ||
              (bytes[i + 1] & 0xc0) !== 0x80 ||
              (bytes[i + 2] & 0xc0) !== 0x80 ||
              (bytes[i + 3] & 0xc0) !== 0x80
            ) {
              hasValidUTF8 = false;
              break;
            }
            i += 3;
          } else {
            hasValidUTF8 = false;
            break;
          }
        }
      }

      if (hasValidUTF8) {
        resolve("UTF-8");
      } else {
        // Provavelmente é Windows-1252 ou ISO-8859-1
        resolve("windows-1252");
      }
    };
    reader.readAsArrayBuffer(file.slice(0, 2048)); // Lê apenas os primeiros 2KB para detecção
  });
};

// Função para ler arquivo com encoding específico
const readFileWithEncoding = (
  file: File,
  encoding: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;

    if (encoding === "UTF-8") {
      reader.readAsText(file, "UTF-8");
    } else {
      // Para outros encodings, lemos como ArrayBuffer e convertemos
      const arrayReader = new FileReader();
      arrayReader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(buffer);
        resolve(text);
      };
      arrayReader.onerror = reject;
      arrayReader.readAsArrayBuffer(file);
    }
  });
};

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleData = [
    {
      invoice: "INV001",
      paymentStatus: "Paid",
      totalAmount: "$250.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV002",
      paymentStatus: "Pending",
      totalAmount: "$150.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV003",
      paymentStatus: "Unpaid",
      totalAmount: "$350.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV004",
      paymentStatus: "Paid",
      totalAmount: "$450.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV005",
      paymentStatus: "Paid",
      totalAmount: "$550.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV006",
      paymentStatus: "Pending",
      totalAmount: "$200.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV007",
      paymentStatus: "Unpaid",
      totalAmount: "$300.00",
      paymentMethod: "Credit Card",
    },
  ];

  const displayData = csvData.length > 0 ? csvData : sampleData;

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Detecta o encoding do arquivo
      const detectedEncoding = await detectEncoding(file);
      console.log("Encoding detectado:", detectedEncoding);

      // Lê o arquivo com o encoding correto
      const fileContent = await readFileWithEncoding(file, detectedEncoding);

      // Processa o CSV com PapaParse
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimitersToGuess: [",", "\t", "|", ";"],
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error("Erros no parsing:", results.errors);
            setError(
              "Erro ao processar arquivo CSV. Verifique o formato do arquivo."
            );
            return;
          }

          const parsedData = results.data as CSVRow[];

          if (parsedData.length === 0) {
            setError("Arquivo CSV está vazio ou não contém dados válidos.");
            return;
          }

          // Limpar headers (remover espaços e caracteres invisíveis)
          const cleanedData = parsedData.map((row) => {
            const cleanRow: CSVRow = {};
            Object.keys(row).forEach((key) => {
              const cleanKey = key.trim().replace(/\uFEFF/g, ""); // Remove BOM se presente
              cleanRow[cleanKey] = row[key] ? row[key].toString().trim() : "";
            });
            return cleanRow;
          });

          // Remove linhas completamente vazias
          const filteredData = cleanedData.filter((row) =>
            Object.values(row).some((value) => value && value.trim() !== "")
          );

          setCsvData(filteredData);
          setFileStats({
            totalRows: filteredData.length,
            columns: Object.keys(filteredData[0] || {}),
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(2) + " KB",
            encoding: detectedEncoding,
          });

          console.log("Arquivo processado com sucesso!");
        },
        error: (error) => {
          console.error("Erro ao processar arquivo CSV:", error);
          setError("Erro ao processar arquivo CSV: " + error.message);
        },
      });
    } catch (error) {
      console.error("Erro ao processar arquivo CSV:", error);
      setError("Erro ao processar arquivo CSV: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        processFile(file);
      } else {
        setError("Por favor, selecione um arquivo CSV válido.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };
  const handleAreaClick = () => {
    document.getElementById("file-input")?.click();
  };
  const renderStatusBadge = (status: string) => {
    const statusClasses = {
      Paid: "bg-green-100 text-green-700",
      Pending: "bg-yellow-100 text-yellow-700",
      Unpaid: "bg-red-100 text-red-700",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
          statusClasses[status as keyof typeof statusClasses] ||
          "bg-gray-100 text-gray-700"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            📊 CSV View | KrittZ
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-col flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 w-full">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3  gap-4 sm:gap-6">
          <Card className="shadow-md border border-gray-200 hover:shadow-xl transition-shadow duration-300 rounded-xl">
            <CardHeader>
              <CardTitle className="font-semibold">Total de Linhas</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 text-3xl font-semibold">
              {fileStats ? fileStats.totalRows : sampleData.length}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-gray-200 hover:shadow-xl transition-shadow duration-300 rounded-xl">
            <CardHeader>
              <CardTitle className="font-semibold">Colunas</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 text-3xl font-semibold">
              {fileStats
                ? fileStats.columns.length
                : Object.keys(sampleData[0]).length}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-gray-200 hover:shadow-xl transition-shadow duration-300 rounded-xl">
            <CardHeader>
              <CardTitle className="font-semibold">Tamanho</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 text-3xl font-semibold">
              {fileStats ? fileStats.fileSize : "N/A"}
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-indigo-500" />
              Importar Arquivo CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`relative p-8 border-2 border-dashed rounded-lg transition-all duration-300 ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50 scale-105"
                  : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleAreaClick}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    Arraste seu arquivo aqui
                  </p>
                  <p className="text-sm text-gray-500">
                    ou clique para selecionar
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Suporte automático para UTF-8, Windows-1252 e ISO-8859-1
                  </p>
                </div>
                <div>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".csv"
                    disabled={isLoading}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Label htmlFor="file-input" className="cursor-pointer">
                    <Button
                      type="button"
                      className="mx-auto bg-indigo-500 hover:bg-indigo-600"
                      disabled={isLoading}
                      onClick={() =>
                        document.getElementById("file-input")?.click()
                      }
                    >
                      {isLoading ? "Processando..." : "Selecionar Arquivo"}
                    </Button>
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button className="bg-indigo-500 hover:bg-indigo-600 text-white flex gap-2 justify-center text-sm sm:text-base transition-all duration-300">
            <FileDown size={16} />
            Baixar PDF
          </Button>
          <Button
            variant="outline"
            className="border-indigo-500 text-indigo-500 hover:bg-indigo-50 flex gap-2 justify-center text-sm sm:text-base transition-all duration-300 bg-transparent"
          >
            <Printer size={16} />
            Imprimir
          </Button>
        </div>

        {/* Table Container com scroll horizontal isolado */}
        <div className="bg-white shadow-md rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableCaption className="text-gray-500 text-sm sm:text-base">
                {csvData.length > 0
                  ? `${csvData.length} registros carregados do seu arquivo CSV`
                  : "Dados de exemplo - carregue um arquivo CSV para ver seus dados"}
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-indigo-50">
                  {csvData.length > 0 ? (
                    Object.keys(csvData[0]).map((header) => (
                      <TableHead
                        key={header}
                        className="font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4"
                      >
                        {header}
                      </TableHead>
                    ))
                  ) : (
                    <>
                      <TableHead className="font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">
                        Invoice
                      </TableHead>
                      <TableHead className="font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">
                        Status
                      </TableHead>
                      <TableHead className="font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">
                        Método
                      </TableHead>
                      <TableHead className="text-right font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">
                        Valor
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((row, index) => (
                  <TableRow
                    key={index}
                    className="hover:bg-indigo-50/50 transition-colors"
                  >
                    {csvData.length > 0 ? (
                      Object.entries(row).map(([key, value]) => (
                        <TableCell
                          key={key}
                          className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap"
                        >
                          {value}
                        </TableCell>
                      ))
                    ) : (
                      <>
                        <TableCell className="font-medium text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                          {(row as any).invoice}
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          {renderStatusBadge((row as any).paymentStatus)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                          {(row as any).paymentMethod}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                          {(row as any).totalAmount}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-900 text-gray-300 py-3 text-center text-xs sm:text-sm mt-auto px-4">
        &copy;{" "}
        <a
          className="hover:underline"
          href="https://github.com/krittz"
          target="_blank"
          rel="noopener noreferrer"
        >
          Krittz
        </a>{" "}
        2025
      </footer>
    </div>
  );
};

export default App;
